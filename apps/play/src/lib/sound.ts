/**
 * Sentezlenmiş sesler (asset yok). Otoplay politikası için AudioContext ilk dokunuşta (katıl butonu) açılır.
 * Tercih `sahne.sound` anahtarında kalıcı; varsayılan açık.
 */
const KEY = "sahne.sound";
let ctx: AudioContext | null = null;
let enabled = readEnabled();
const listeners = new Set<(on: boolean) => void>();

function readEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function isSoundEnabled(): boolean { return enabled; }
export function setSoundEnabled(on: boolean) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* ignore */ }
  if (on) unlockAudio();
  listeners.forEach((l) => l(on));
}
export function onSoundChange(l: (on: boolean) => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Kullanıcı dokunuşunda çağır: context'i oluşturur/çözer. */
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* ses yok */ }
}

type Wave = OscillatorType;
function tone(freq: number, startOffset: number, duration: number, opts: { type?: Wave; gain?: number; slideTo?: number } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + duration);
  const peak = opts.gain ?? 0.12;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sound = {
  /** Doğru: kısa, yükselen iki nota. */
  correct() { tone(523.25, 0, 0.12, { type: "triangle" }); tone(783.99, 0.11, 0.2, { type: "triangle" }); },
  /** Yanlış: düşük vızıltı. */
  wrong() { tone(110, 0, 0.28, { type: "sawtooth", gain: 0.06, slideTo: 90 }); },
  /** "İçeridesin" pop. */
  pop() { tone(660, 0, 0.09, { type: "sine", gain: 0.1, slideTo: 990 }); },
  /** Son 3 saniye tik'i: çok hafif. */
  tick() { tone(1200, 0, 0.035, { type: "square", gain: 0.02 }); },
};
