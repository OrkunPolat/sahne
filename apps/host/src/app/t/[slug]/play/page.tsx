"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { beginRun, maxBracketSize, resolveMatch, type BracketRun } from "@sahne/engine";
import { BRACKET_SIZES, type Tournament } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { ApiError } from "@/lib/api";
import { errText, getDeviceId, getTournament, postPlay } from "@/lib/tournaments";
import { ChampionCard, Confetti, ItemCard, useRoundLabel } from "@/components/tournament/Matchup";

type Phase = "pick" | "play" | "champion";
const SWAP_MS = 260;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export default function PlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useT();
  const roundLabel = useRoundLabel();
  const [tn, setTn] = useState<Tournament | null>(null);
  const [error, setError] = useState<{ notFound: boolean; text: string } | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [size, setSize] = useState(4);
  const [run, setRun] = useState<BracketRun | null>(null);
  const [leaving, setLeaving] = useState<"a" | "b" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [copied, setCopied] = useState(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    getTournament(slug)
      .then((r) => {
        if (!alive) return;
        setTn(r.tournament);
        const max = maxBracketSize(r.tournament.items.length);
        setSize(Math.min(max, 32));
      })
      .catch((e: unknown) => { if (alive) setError({ notFound: e instanceof ApiError && e.status === 404, text: errText(e) }); });
    return () => { alive = false; };
  }, [slug]);

  const maxSize = tn ? maxBracketSize(tn.items.length) : 0;
  const sizes = useMemo(() => BRACKET_SIZES.filter((s) => s <= maxSize), [maxSize]);

  const start = useCallback(() => {
    if (!tn) return;
    setRun(beginRun("solo", tn.items, size));
    setPhase("play"); setSaveState("idle"); setLeaving(null);
  }, [tn, size]);

  // Sıradaki eşleşmenin görsellerini önceden yükle.
  useEffect(() => {
    if (!run) return;
    for (const it of [...run.queue.slice(2, 6), ...run.winners.slice(0, 2)]) {
      if (it.imageUrl) { const im = new Image(); im.src = it.imageUrl; }
    }
  }, [run]);

  const pick = useCallback((side: "a" | "b") => {
    if (!run || !run.state.current || leaving) return;
    const next = resolveMatch(run, side === "a" ? 1 : 0, side === "a" ? 0 : 1);
    const apply = () => {
      setRun(next); setLeaving(null);
      if (next.state.champion) setPhase("champion");
    };
    if (prefersReducedMotion()) { apply(); return; }
    setLeaving(side);
    swapTimer.current = setTimeout(apply, SWAP_MS);
  }, [run, leaving]);

  useEffect(() => () => { if (swapTimer.current) clearTimeout(swapTimer.current); }, []);

  useEffect(() => {
    if (phase !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); pick("a"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); pick("b"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, pick]);

  // Şampiyon → sonucu sunucuya işle (docs/API.md: POST /api/tournaments/:id/plays).
  useEffect(() => {
    if (phase !== "champion" || !run?.state.champion || !tn || saveState !== "idle") return;
    setSaveState("saving");
    postPlay(tn.id, { size: run.state.size, results: run.state.results, championId: run.state.champion.id }, getDeviceId())
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("failed"));
  }, [phase, run, tn, saveState]);

  async function share() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/t/${slug}`); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  if (error) {
    return (
      <main className="h-page t-page">
        <div className="s-card h-notice"><p>{error.notFound ? t("tournament.notFound") : error.text}</p><Link className="s-btn" href="/t">{t("tournament.backToGallery")}</Link></div>
      </main>
    );
  }
  if (!tn) return <main className="h-page t-page"><div className="h-empty"><span className="h-spinner h-spinner--lg" /></div></main>;

  if (phase === "pick") {
    return (
      <main className="t-play t-play--pick">
        <div className="t-modal s-card s-card--glow s-pop" role="dialog" aria-labelledby="pick-title">
          <p className="s-muted t-modal__kicker"><Link href={`/t/${tn.slug}`} className="t-back">← {tn.title}</Link></p>
          <h1 id="pick-title">{t("tournament.pickSize")}</h1>
          <p className="s-muted">{t("tournament.pickSizeHint")}</p>
          <div className="t-sizes" role="group">
            {sizes.map((s) => (
              <button key={s} type="button" className={`t-size${size === s ? " t-size--on" : ""}`} aria-pressed={size === s} onClick={() => setSize(s)}>
                <b>{s}</b><small>{t("tournament.sizeLabel", { n: s })}</small>
              </button>
            ))}
          </div>
          <button type="button" className="s-btn s-btn--primary s-btn--lg" onClick={start}>▶ {t("tournament.startPlay")}</button>
        </div>
      </main>
    );
  }

  if (phase === "champion" && run?.state.champion) {
    return (
      <main className="t-play t-play--champ">
        <Confetti />
        <ChampionCard item={run.state.champion} label={t("tournament.champion")} />
        <p className="s-muted t-play__save" aria-live="polite">
          {saveState === "saved" ? `✓ ${t("tournament.playSaved")}` : saveState === "failed" ? t("tournament.playNotSaved") : saveState === "saving" ? t("common.loading") : ""}
        </p>
        <div className="h-actions t-play__actions">
          <button type="button" className="s-btn s-btn--primary s-btn--lg" onClick={() => setPhase("pick")}>↻ {t("tournament.playAgain")}</button>
          <Link href={`/t/${tn.slug}`} className="s-btn s-btn--lg">{t("tournament.results")} →</Link>
          <button type="button" className="s-btn s-btn--lg" onClick={share}>{copied ? `✓ ${t("tournament.linkCopied")}` : `⧉ ${t("tournament.share")}`}</button>
        </div>
      </main>
    );
  }

  const st = run!.state;
  const cur = st.current!;
  const done = st.results.length;
  const total = st.size - 1;

  return (
    <main className="t-play">
      <div className="t-play__head">
        <Link href={`/t/${tn.slug}`} className="t-back s-muted">← {tn.title}</Link>
        <div className="t-play__label">
          <b>{roundLabel(st.round)}</b>
          <span className="s-muted">· {t("tournament.matchOf", { i: st.matchIdx + 1, n: st.matchesInRound })}</span>
        </div>
        <span className="p-kbd t-play__kbd">{t("tournament.keyboardHint")}</span>
      </div>
      <div className="t-progress" aria-hidden><i style={{ width: `${(done / total) * 100}%` }} /></div>

      <div className={`t-vs${leaving ? ` t-vs--leave-${leaving === "a" ? "b" : "a"}` : ""}`} key={`${st.round}-${st.matchIdx}`}>
        <ItemCard item={cur.a} side="a" onPick={() => pick("a")} big state={leaving === "a" ? "winner" : leaving === "b" ? "loser" : "idle"} />
        <div className="t-vs__badge" aria-hidden><span>VS</span></div>
        <ItemCard item={cur.b} side="b" onPick={() => pick("b")} big state={leaving === "b" ? "winner" : leaving === "a" ? "loser" : "idle"} />
      </div>
    </main>
  );
}
