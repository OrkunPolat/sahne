"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TimerRing } from "@sahne/ui";
import type { ClientMessage } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { PLAY_URL } from "@/lib/api";
import { findInRegistry, type HostSession } from "@/lib/registry";
import { useHostSocket } from "@/lib/useHostSocket";
import { Lobby } from "@/components/present/Lobby";
import { Leaderboard } from "@/components/present/Leaderboard";
import { ExportButtons } from "@/components/present/ExportButtons";
import { Podium } from "@/components/present/Podium";
import { ChoiceTiles, OpenCards, ScaleBars, TrueFalseTiles, WordCloud } from "@/components/present/TallyViews";
import { Reactions } from "@/components/present/Reactions";
import { Fastest } from "@/components/present/Fastest";
import { TeamPodium, TeamStandings } from "@/components/present/TeamStandings";
import { QaBoard } from "@/components/present/QaBoard";
import { SeriesPanel } from "@/components/present/SeriesPanel";
import { PublicLink } from "@/components/present/PublicLink";
import { SoundToggle } from "@/components/present/SoundToggle";
import { initSound, sfx } from "@/lib/sound";

const FATAL_ERRORS = ["bad_code", "bad_secret", "session_ended"] as const;
type FatalError = (typeof FATAL_ERRORS)[number];
const isFatal = (e: string | null): e is FatalError => (FATAL_ERRORS as readonly string[]).includes(e ?? "");

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const [reg, setReg] = useState<HostSession | null | undefined>(undefined);
  useEffect(() => { setReg(findInRegistry(id) ?? null); }, [id]);

  const { state, send } = useHostSocket(reg?.code ?? null, reg?.hostSecret ?? null);
  const snap = state.snapshot;
  const slide = snap && snap.currentSlideIdx >= 0 ? snap.slides[snap.currentSlideIdx] ?? null : null;
  const phase = snap?.phase ?? null;
  const slidePhase = snap?.slidePhase ?? null;
  const isGame = slide?.mode === "game";
  const playHost = PLAY_URL.replace(/^https?:\/\//, "");

  const actions = useMemo(() => {
    const go = (m: ClientMessage) => send(m);
    return {
      start: () => { initSound(); go({ t: "host:start" }); },
      next: () => go({ t: "host:next" }),
      prev: () => go({ t: "host:prev" }),
      lock: () => go({ t: "host:lock" }),
      reveal: () => go({ t: "host:reveal" }),
      end: () => { if (window.confirm(t("host.confirmEnd"))) go({ t: "host:end" }); },
    };
  }, [send, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); phase === "lobby" ? actions.start() : actions.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); actions.prev(); }
      else if (e.key === " " || e.code === "Space") { e.preventDefault(); if (slidePhase && slidePhase !== "revealed") actions.reveal(); }
      else if (e.key.toLowerCase() === "l") { if (slidePhase === "open") actions.lock(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, phase, slidePhase]);

  // Otomatik oynatma kuralı: AudioContext ilk kullanıcı hareketinde açılır (Başlat tıklaması dahil her jest).
  useEffect(() => {
    const once = () => { initSound(); window.removeEventListener("pointerdown", once); window.removeEventListener("keydown", once); };
    window.addEventListener("pointerdown", once);
    window.addEventListener("keydown", once);
    return () => { window.removeEventListener("pointerdown", once); window.removeEventListener("keydown", once); };
  }, []);

  // Ses efektleri: geçişlere bağlı (ilk snapshot'ta çalmaz).
  const prevSlidePhase = useRef<typeof slidePhase>(null);
  useEffect(() => {
    const was = prevSlidePhase.current;
    prevSlidePhase.current = slidePhase;
    if (was === "open" && slidePhase === "locked") sfx.lock();
    else if (was && was !== "revealed" && slidePhase === "revealed") sfx.reveal();
  }, [slidePhase]);
  const prevPhase = useRef<typeof phase>(null);
  useEffect(() => {
    if (prevPhase.current === "live" && phase === "ended") sfx.fanfare();
    prevPhase.current = phase;
  }, [phase]);
  const participantCount = snap?.participants.length ?? 0;
  const prevCount = useRef<number | null>(null);
  useEffect(() => {
    if (phase === "lobby" && prevCount.current !== null && participantCount > prevCount.current) sfx.pop();
    prevCount.current = phase === "lobby" ? participantCount : null;
  }, [participantCount, phase]);
  // Son 5 saniyede tik: sunucu saatine göre kalan süre.
  const startedAt = snap?.slideStartedAt ?? null;
  const limitS = slide && slide.type !== "title" ? slide.timeLimitS : null;
  const clockOffset = state.clockOffset;
  useEffect(() => {
    if (slidePhase !== "open" || startedAt === null || limitS === null) return;
    let last = -1;
    const id = setInterval(() => {
      const remain = Math.ceil((limitS * 1000 - (Date.now() + clockOffset - startedAt)) / 1000);
      if (remain !== last) { last = remain; if (remain >= 1 && remain <= 5) sfx.tick(); }
    }, 100);
    return () => clearInterval(id);
  }, [slidePhase, startedAt, limitS, clockOffset]);

  if (reg === undefined) return <main className="p-center"><p className="s-muted">{t("common.loading")}</p></main>;
  if (reg === null) {
    return (
      <main className="p-center">
        <div className="s-card h-notice" style={{ maxWidth: 520 }}>
          <h2>{t("error.bad_secret")}</h2><p className="s-muted">{t("host.secretHint")}</p>
          <Link className="s-btn" href="/">{t("host.mySessions")}</Link>
        </div>
      </main>
    );
  }
  if (isFatal(state.error)) {
    return (
      <main className="p-center">
        <div className="s-card h-notice" style={{ maxWidth: 520 }}>
          <h2>{t(`error.${state.error}`)}</h2>
          <Link className="s-btn" href="/">{t("host.mySessions")}</Link>
        </div>
      </main>
    );
  }
  if (!snap) {
    return (
      <main className="p-center">
        <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
          <span className="s-chip">{state.status === "reconnecting" ? t("common.reconnecting") : t("common.loading")}</span>
          <p className="s-muted">{state.status === "reconnecting" ? t("common.disconnected") : ""}</p>
        </div>
      </main>
    );
  }

  const participants = snap.participants;
  const answered = state.answeredCount;
  const total = participants.length;
  const correct = state.reveal?.correct ?? null;
  const revealed = slidePhase === "revealed";
  const showCounts = !isGame || revealed;
  const teams = snap.meta.teams;
  const hasTeams = teams.length > 0;
  const endedTeams = state.teams;
  const publicToken = state.publicToken ?? snap.meta.publicToken;

  return (
    <main className="p-stage">
      <div className="p-top">
        <span className="title">{snap.meta.title}</span>
        {snap.meta.isDemo && <span className="h-demo-badge">{t("host.demoBadge")}</span>}
        {phase === "live" && slide && <span className="p-idx">{snap.currentSlideIdx + 1} / {snap.slides.length}</span>}
        <span className="spacer" />
        <SoundToggle />
        {phase !== "ended" && (
          <span className="s-chip p-chip-code">{playHost} · <b className="h-code">{snap.meta.code}</b></span>
        )}
      </div>

      <section className="p-main" key={`${phase}-${snap.currentSlideIdx}-${revealed}`}>
        {phase === "lobby" && (
          <Lobby code={snap.meta.code} playHost={playHost} participants={participants} teams={teams} onStart={actions.start} canStart={snap.slides.length > 0} />
        )}

        {phase === "live" && slide && (
          <div className={revealed && isGame ? "p-reveal" : undefined}>
            <div style={{ display: "grid", gap: "clamp(24px, 4vh, 48px)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 32, justifyContent: "space-between" }}>
                <div>
                  <h1 className="p-question">{slide.text}</h1>
                  {slide.type === "title" && slide.subtitle && <p className="p-subtitle" style={{ marginTop: 16 }}>{slide.subtitle}</p>}
                </div>
                {slide.type !== "title" && slidePhase === "open" && snap.slideStartedAt !== null && (
                  <TimerRing startedAt={snap.slideStartedAt} limitS={slide.timeLimitS} clockOffset={state.clockOffset} size={120} />
                )}
              </div>
              {slide.type === "multiple_choice" && <ChoiceTiles slide={slide} tally={state.tally} correct={Array.isArray(correct) ? correct : null} showCounts={showCounts} />}
              {slide.type === "true_false" && <TrueFalseTiles tally={state.tally} correct={typeof correct === "boolean" ? correct : null} showCounts={showCounts} />}
              {slide.type === "word_cloud" && <WordCloud tally={state.tally} />}
              {slide.type === "open_ended" && <OpenCards tally={state.tally} />}
              {slide.type === "scale" && <ScaleBars slide={slide} tally={state.tally} />}
              {slide.type === "qa" && <QaBoard tally={state.tally} />}
            </div>
            {revealed && isGame && (
              <div className="p-side">
                <Leaderboard entries={state.reveal?.leaderboard ?? state.leaderboard} />
                <Fastest entries={state.reveal?.fastest ?? []} />
                {hasTeams && <TeamStandings teams={state.reveal?.teams ?? endedTeams} />}
              </div>
            )}
          </div>
        )}

        {phase === "ended" && (
          <div style={{ display: "grid", gap: 48 }}>
            {endedTeams.length > 0 && (
              <>
                <h1 className="p-question" style={{ textAlign: "center", margin: "0 auto" }}>{t("host.teamPodium")}</h1>
                <TeamPodium teams={endedTeams} />
              </>
            )}
            <h2 className={endedTeams.length > 0 ? "p-subtitle" : "p-question"} style={{ textAlign: "center", margin: "0 auto" }}>{t("host.podium")}</h2>
            <Podium podium={state.podium ?? state.leaderboard.slice(0, 3)} />
            {state.leaderboard.length > 3 && <div className="p-rest"><Leaderboard entries={state.leaderboard.slice(3)} limit={50} title={t("host.allParticipants")} /></div>}
            {snap.meta.seriesKey && <div className="p-rest"><SeriesPanel sessionId={reg.id} secret={reg.hostSecret} seriesKey={snap.meta.seriesKey} /></div>}
            {publicToken && <div className="p-rest"><PublicLink token={publicToken} /></div>}
          </div>
        )}
      </section>

      <div className="p-bottom">
        {phase === "live" && slide && slide.type !== "title" && (
          <span className="s-chip" style={{ fontSize: "1rem" }}>{t("host.answered", { answered, total })}</span>
        )}
        {phase === "live" && slidePhase && slidePhase !== "open" && (
          <span className="s-chip">{slidePhase === "locked" ? t("host.locked") : t("host.revealed")}</span>
        )}
        <span className="p-kbd"><kbd>←</kbd><kbd>→</kbd> <kbd>Space</kbd> <kbd>L</kbd></span>
        <span className="spacer" />
        {phase !== "ended" && (
          <div className="p-controls">
            {phase === "lobby" ? (
              <button type="button" className="s-btn s-btn--primary" onClick={actions.start} disabled={snap.slides.length === 0}>{t("common.start")}</button>
            ) : (
              <>
                <button type="button" className="s-btn" onClick={actions.prev} disabled={snap.currentSlideIdx <= 0}>← {t("common.prev")}</button>
                <button type="button" className="s-btn" onClick={actions.lock} disabled={slidePhase !== "open"}>{t("common.lock")}</button>
                <button type="button" className="s-btn s-btn--primary" onClick={actions.reveal} disabled={!slidePhase || slidePhase === "revealed"}>{t("common.reveal")}</button>
                <button type="button" className="s-btn s-btn--primary" onClick={actions.next}>
                  {snap.currentSlideIdx >= snap.slides.length - 1 ? t("host.podium") : t("common.next")} →
                </button>
              </>
            )}
            <button type="button" className="s-btn s-btn--ghost" onClick={actions.end}>{t("common.end")}</button>
          </div>
        )}
        {phase === "ended" && (
          <>
            <ExportButtons sessionId={reg!.id} secret={reg!.hostSecret} title={snap.meta.title} />
            <Link className="s-btn" href="/">{t("host.mySessions")}</Link>
          </>
        )}
      </div>

      <Reactions items={state.reactions} />

      {state.status !== "open" && (
        <div className="p-status s-chip s-pop">{state.status === "closed" ? t("common.disconnected") : t("common.reconnecting")}</div>
      )}
    </main>
  );
}
