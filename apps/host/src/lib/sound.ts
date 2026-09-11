"use client";

/**
 * Sunum ses efektleri: varlık dosyası yok, hepsi Web Audio ile sentezlenir.
 * AudioContext tarayıcı otomatik oynatma kuralı yüzünden ilk kullanıcı hareketinde (Başlat tıklaması) açılır.
 */

const STORAGE_KEY = "sahne.sound";
let ctx: AudioContext | null = null;
let muted = false;
let loaded = false;

function loadPref() {
  if (loaded) return;
  loaded = true;
  try { muted = localStorage.getItem(STORAGE_KEY) === "off"; } catch { muted = false; }
}

export function isSoundMuted(): boolean { loadPref(); return muted; }

export function setSoundMuted(next: boolean) {
  loadPref();
  muted = next;
  try { localStorage.setItem(STORAGE_KEY, next ? "off" : "on"); } catch { /* ignore */ }
  if (!next) initSound();
}

/** İlk kullanıcı hareketinde çağır; context yoksa açar, askıdaysa devam ettirir. */
export function initSound() {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch { ctx = null; }
}

function ready(): AudioContext | null {
  loadPref();
  if (muted || !ctx || ctx.state !== "running") return null;
  return ctx;
}

type Wave = OscillatorType;

/** Tek nota: zarf = hızlı atak, üstel sönüm. */
function note(ac: AudioContext, freq: number, at: number, dur: number, gain = 0.2, type: Wave = "sine", slideTo?: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** Kısa gürültü vuruşu (thud gövdesi için). */
function thump(ac: AudioContext, at: number) {
  const len = Math.floor(ac.sampleRate * 0.12);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 220;
  const g = ac.createGain();
  g.gain.value = 0.5;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(at);
}

export const sfx = {
  /** Son 5 saniyede her saniye. */
  tick() {
    const ac = ready(); if (!ac) return;
    note(ac, 1450, ac.currentTime, 0.05, 0.12, "square");
  },
  /** Kilit: alçak, tok vuruş. */
  lock() {
    const ac = ready(); if (!ac) return;
    const t = ac.currentTime;
    thump(ac, t);
    note(ac, 140, t, 0.22, 0.35, "sine", 55);
  },
  /** Göster: iki notalı parlak çan. */
  reveal() {
    const ac = ready(); if (!ac) return;
    const t = ac.currentTime;
    note(ac, 880, t, 0.35, 0.18, "triangle");
    note(ac, 1318.5, t + 0.09, 0.5, 0.16, "triangle");
    note(ac, 2637, t + 0.09, 0.25, 0.05, "sine");
  },
  /** Podyum: majör arpej + tepe nota. */
  fanfare() {
    const ac = ready(); if (!ac) return;
    const t = ac.currentTime;
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      note(ac, f, t + i * 0.13, i === seq.length - 1 ? 0.9 : 0.22, 0.18, "triangle");
      note(ac, f / 2, t + i * 0.13, i === seq.length - 1 ? 0.9 : 0.22, 0.08, "sine");
    });
  },
  /** Lobiye katılım: yumuşak "pop". */
  pop() {
    const ac = ready(); if (!ac) return;
    note(ac, 520, ac.currentTime, 0.12, 0.14, "sine", 900);
  },
};
