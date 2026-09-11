import { useEffect, useMemo, useRef, useState } from "react";
import type { BracketMatchResult, BracketState, Slide, Tally, TournamentItem } from "@sahne/protocol";
import { TimerRing } from "@sahne/ui";
import { useI18n } from "../lib/i18n";
import { sound } from "../lib/sound";

type BracketSlide = Extract<Slide, { type: "bracket" }>;
type ChoiceTally = Extract<Tally, { kind: "choice" }>;

/** Bir eşleşmenin cevap anahtarı: slayt + tur + eşleşme (tur değişince matchIdx sıfırlanabilir). */
export function bracketAnswerKey(slideId: string, state: Pick<BracketState, "round" | "matchIdx">): string {
  return `${slideId}:${state.round}:${state.matchIdx}`;
}

export interface BracketRevealInfo { tally: ChoiceTally | null }

interface Props {
  slide: BracketSlide;
  state: BracketState;
  startedAt: number;
  clockOffset: number;
  /** slide:phase locked/revealed → oy kapalı */
  locked: boolean;
  /** Reveal geldiyse (phase revealed) o eşleşmenin oyları. */
  reveal: BracketRevealInfo | null;
  /** Bu eşleşme için cevap gönderildi (kalıcı anahtar; yeniden bağlanınca seçim bilinmeyebilir). */
  sent: boolean;
  /** Bu eşleşme için gönderilen item id (yerel). */
  pickedId: string | null;
  onPick: (itemId: string) => void;
}

/* ---------- yardımcılar ---------- */

function useTimeUp(startedAt: number, limitS: number, clockOffset: number) {
  const deadline = startedAt + limitS * 1000;
  const [up, setUp] = useState(() => Date.now() + clockOffset >= deadline);
  useEffect(() => {
    setUp(Date.now() + clockOffset >= deadline);
    const id = setInterval(() => { if (Date.now() + clockOffset >= deadline) { setUp(true); clearInterval(id); } }, 200);
    return () => clearInterval(id);
  }, [deadline, clockOffset]);
  return up;
}

function useTick(startedAt: number, limitS: number, clockOffset: number, active: boolean) {
  const last = useRef<number>(-1);
  useEffect(() => {
    if (!active) return;
    const deadline = startedAt + limitS * 1000;
    const id = setInterval(() => {
      const remain = Math.ceil((deadline - (Date.now() + clockOffset)) / 1000);
      if (remain >= 1 && remain <= 3 && remain !== last.current) { last.current = remain; sound.tick(); }
    }, 100);
    return () => clearInterval(id);
  }, [startedAt, limitS, clockOffset, active]);
}

/** Görsel yoksa isimden deterministik, tema uyumlu bir gradyan. */
function hueOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

/* ---------- ekran ---------- */

export function BracketScreen({ slide, state, startedAt, clockOffset, locked, reveal, sent, pickedId, onPick }: Props) {
  const { t } = useI18n();
  const items = useMemo(() => {
    const m = new Map<string, TournamentItem>();
    for (const it of slide.items) m.set(it.id, it);
    if (state.current) { m.set(state.current.a.id, state.current.a); m.set(state.current.b.id, state.current.b); }
    for (const r of state.results) { if (!m.has(r.aId)) m.set(r.aId, { id: r.aId, name: r.aId, imageUrl: null }); if (!m.has(r.bId)) m.set(r.bId, { id: r.bId, name: r.bId, imageUrl: null }); }
    if (state.champion) m.set(state.champion.id, state.champion);
    return m;
  }, [slide.items, state]);

  // Oylanan çift: phase open iken current; reveal'de current bir sonrakine geçmiş olabilir → son sonuç.
  const votingPair = useRef<{ a: TournamentItem; b: TournamentItem; round: number; matchIdx: number; matchesInRound: number } | null>(null);
  if (!locked && state.current) {
    votingPair.current = { a: state.current.a, b: state.current.b, round: state.round, matchIdx: state.matchIdx, matchesInRound: state.matchesInRound };
  }

  if (state.champion) return <Champion item={state.champion} pickedId={pickedId} lastResult={state.results[state.results.length - 1] ?? null} />;

  if (reveal) {
    const last = state.results[state.results.length - 1] ?? null;
    const pair = votingPair.current;
    const resolved: BracketMatchResult | null =
      last && pair && last.aId === pair.a.id && last.bId === pair.b.id ? last
      : last && !pair ? last
      : null;
    const a = resolved ? items.get(resolved.aId) : pair?.a;
    const b = resolved ? items.get(resolved.bId) : pair?.b;
    if (a && b) {
      const counts = reveal.tally?.counts ?? {};
      const votesA = resolved ? resolved.votesA : counts[a.id] ?? 0;
      const votesB = resolved ? resolved.votesB : counts[b.id] ?? 0;
      const winnerId = resolved ? resolved.winnerId : votesA === votesB ? null : votesA > votesB ? a.id : b.id;
      const roundLabel = pair ? roundText(t, pair.round, pair.matchIdx, pair.matchesInRound) : null;
      return <MatchResult a={a} b={b} votesA={votesA} votesB={votesB} winnerId={winnerId} pickedId={pickedId} roundLabel={roundLabel} />;
    }
  }

  const current = state.current;
  if (!current) {
    return <div className="p-center s-fade-in"><div className="p-state"><div className="p-sub">{t("play.waitingHost")}</div></div></div>;
  }

  return <Matchup slide={slide} state={state} current={current} startedAt={startedAt} clockOffset={clockOffset} locked={locked} sent={sent} pickedId={pickedId} onPick={onPick} />;
}

function roundText(t: ReturnType<typeof useI18n>["t"], round: number, matchIdx: number, total: number): string {
  const vars = { round, n: matchIdx + 1, total };
  return round <= 2 ? t("play.bracketFinal", vars) : t("play.bracketRound", vars);
}

/* ---------- eşleşme: oy ver ---------- */

function Matchup({ slide, state, current, startedAt, clockOffset, locked, sent: sentFlag, pickedId, onPick }: Omit<Props, "reveal"> & { current: NonNullable<BracketState["current"]> }) {
  const { t } = useI18n();
  const timeUp = useTimeUp(startedAt, slide.timeLimitS, clockOffset);
  const sent = sentFlag || pickedId !== null;
  const disabled = locked || timeUp || sent;
  useTick(startedAt, slide.timeLimitS, clockOffset, !locked && !timeUp && !sent);
  const { a, b } = current;
  const pairKey = `${state.round}:${state.matchIdx}`;

  const tap = (id: string) => {
    if (disabled) return;
    try { navigator.vibrate?.(12); } catch { /* ignore */ }
    onPick(id);
  };

  return (
    <div className="p-stack p-bracket" style={{ flex: 1 }}>
      <div className="p-slide-head">
        <div className="p-stack" style={{ gap: 4 }}>
          <div className="p-label">{roundText(t, state.round, state.matchIdx, state.matchesInRound)}</div>
          <div className="p-question">{slide.text}</div>
        </div>
        <TimerRing startedAt={startedAt} limitS={slide.timeLimitS} clockOffset={clockOffset} size={56} />
      </div>

      <div key={pairKey} className="p-bracket__pair p-bracket__pair--in">
        <ItemCard item={a} state={cardState(a.id, pickedId, sent || timeUp || locked)} disabled={disabled} onClick={() => tap(a.id)} />
        <div className="p-bracket__vs" aria-hidden>vs</div>
        <ItemCard item={b} state={cardState(b.id, pickedId, sent || timeUp || locked)} disabled={disabled} onClick={() => tap(b.id)} />
      </div>

      <div className="p-bracket__foot">
        {sent ? (
          <div className="p-state s-pop" style={{ padding: 8 }}>
            <div className="p-sent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
              <span>{t("play.bracketVoted")}</span>
            </div>
            <div className="p-sub" style={{ marginTop: 4 }}>{t("play.waitingOthers")}</div>
          </div>
        ) : timeUp || locked ? (
          <div className="p-state" style={{ padding: 8 }}>
            <div className="p-state__title" style={{ fontSize: "1.2rem" }}>{t("play.timeUp")}</div>
            <div className="p-sub" style={{ marginTop: 4 }}>{t("play.waitingOthers")}</div>
          </div>
        ) : (
          <div className="p-sub" style={{ textAlign: "center" }}>{t("play.bracketPick")}</div>
        )}
      </div>
    </div>
  );
}

type CardState = "idle" | "selected" | "dim" | "winner" | "loser";
function cardState(id: string, pickedId: string | null, settled: boolean): CardState {
  if (pickedId === id) return "selected";
  if (settled) return "dim";
  return "idle";
}

/* ---------- eşleşme sonucu ---------- */

function MatchResult({ a, b, votesA, votesB, winnerId, pickedId, roundLabel }: {
  a: TournamentItem; b: TournamentItem; votesA: number; votesB: number; winnerId: string | null; pickedId: string | null; roundLabel: string | null;
}) {
  const { t } = useI18n();
  const mine: "won" | "lost" | "none" = pickedId === null || winnerId === null ? "none" : pickedId === winnerId ? "won" : "lost";

  useEffect(() => {
    if (mine === "none") return;
    try { navigator.vibrate?.(mine === "won" ? [40] : [60, 40, 60]); } catch { /* ignore */ }
    if (mine === "won") sound.correct(); else sound.wrong();
  }, [mine]);

  const st = (id: string): CardState => (winnerId === null ? (pickedId === id ? "selected" : "idle") : id === winnerId ? "winner" : "loser");
  const verdict = mine === "won" ? t("play.bracketYouWon") : mine === "lost" ? t("play.bracketYouLost") : t("play.bracketNoVote");
  const verdictCls = mine === "won" ? "p-result__title--ok" : mine === "lost" ? "p-result__title--bad" : "";

  return (
    <div className="p-stack p-bracket s-fade-in" style={{ flex: 1 }}>
      <div className="p-slide-head">
        <div className="p-stack" style={{ gap: 4 }}>
          {roundLabel && <div className="p-label">{roundLabel}</div>}
          <div className="p-question">{t("play.bracketWinner")}</div>
        </div>
        <div className="p-bracket__score s-pop" aria-label={`${votesA} – ${votesB}`}>
          <span className={a.id === winnerId ? "p-bracket__score--win" : ""}>{votesA}</span>
          <span className="p-bracket__score-dash">–</span>
          <span className={b.id === winnerId ? "p-bracket__score--win" : ""}>{votesB}</span>
        </div>
      </div>

      <div className="p-bracket__pair">
        <ItemCard item={a} state={st(a.id)} disabled votes={votesA} mine={pickedId === a.id} />
        <div className="p-bracket__vs" aria-hidden>vs</div>
        <ItemCard item={b} state={st(b.id)} disabled votes={votesB} mine={pickedId === b.id} />
      </div>

      <div className="p-bracket__foot">
        <div className={`p-bracket__verdict s-pop ${verdictCls}`}>{verdict}</div>
        <div className="p-sub" style={{ textAlign: "center" }}>{t("play.bracketNext")}</div>
      </div>
    </div>
  );
}

/* ---------- şampiyon ---------- */

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: (i * 37) % 100,
  delay: ((i * 53) % 100) / 100 * 2.4,
  dur: 3.2 + ((i * 29) % 100) / 100 * 2.2,
  size: 4 + ((i * 17) % 5),
  rot: ((i * 71) % 360),
}));

function Champion({ item, pickedId, lastResult }: { item: TournamentItem; pickedId: string | null; lastResult: BracketMatchResult | null }) {
  const { t } = useI18n();
  // Final eşleşmesine oy verildiyse sonucu sesle işaretle.
  const mine: "won" | "lost" | "none" = pickedId === null ? "none" : pickedId === item.id ? "won" : "lost";
  useEffect(() => {
    try { navigator.vibrate?.(mine === "lost" ? [60, 40, 60] : [30, 30, 30, 30, 60]); } catch { /* ignore */ }
    if (mine === "lost") sound.wrong(); else sound.correct();
  }, [mine]);

  return (
    <div className="p-center p-bracket__champ s-fade-in">
      <div className="p-bracket__particles" aria-hidden>
        {PARTICLES.map((p) => (
          <span key={p.id} className="p-bracket__particle" style={{ left: `${p.x}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, width: p.size, height: p.size, ["--rot" as string]: `${p.rot}deg` }} />
        ))}
      </div>
      <div className="p-label" style={{ textAlign: "center" }}>{t("play.bracketChampion")}</div>
      <div className="p-bracket__champ-card s-pop">
        <ItemCard item={item} state="winner" disabled big />
      </div>
      <div className="p-bracket__champ-name s-pop" style={{ animationDelay: "160ms" }}>{item.name}</div>
      {lastResult && (
        <div className="p-sub s-pop" style={{ textAlign: "center", animationDelay: "240ms" }}>
          {t("play.bracketVotes", { n: lastResult.winnerId === lastResult.aId ? lastResult.votesA : lastResult.votesB })}
          {mine !== "none" && <> · {mine === "won" ? t("play.bracketYouWon") : t("play.bracketYouLost")}</>}
        </div>
      )}
      <div className="p-sub" style={{ textAlign: "center" }}>{t("play.bracketChampionSub")}</div>
    </div>
  );
}

/* ---------- aday kartı ---------- */

function ItemCard({ item, state, disabled, onClick, votes, mine, big }: {
  item: TournamentItem; state: CardState; disabled: boolean; onClick?: () => void; votes?: number; mine?: boolean; big?: boolean;
}) {
  const { t } = useI18n();
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [item.imageUrl]);
  const showImg = !!item.imageUrl && !broken;
  const hue = hueOf(item.id);
  const initial = (item.name.trim()[0] ?? "?").toUpperCase();
  const cls = `p-bracket__card p-bracket__card--${state} ${big ? "p-bracket__card--big" : ""}`;
  const inner = (
    <>
      {showImg ? (
        <img className="p-bracket__img" src={item.imageUrl!} alt="" loading="eager" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <div className="p-bracket__img p-bracket__img--fallback" style={{ background: `linear-gradient(160deg, hsl(${hue} 45% 38%), hsl(${(hue + 40) % 360} 55% 18%))` }}>
          <span>{initial}</span>
        </div>
      )}
      <div className="p-bracket__shade" aria-hidden />
      {!big && <div className="p-bracket__name">{item.name}</div>}
      {state === "selected" && <span className="p-bracket__badge p-bracket__badge--you">✓</span>}
      {(state === "winner" || state === "loser") && votes !== undefined && (
        <span className={`p-bracket__badge ${state === "winner" ? "p-bracket__badge--win" : ""}`}>
          {t("play.bracketVotes", { n: votes })}{mine ? " · ✓" : ""}
        </span>
      )}
      {state === "winner" && !big && <span className="p-bracket__crown" aria-hidden>★</span>}
    </>
  );
  if (onClick) {
    return <button type="button" className={cls} disabled={disabled} aria-pressed={state === "selected"} onClick={onClick}>{inner}</button>;
  }
  return <div className={cls}>{inner}</div>;
}
