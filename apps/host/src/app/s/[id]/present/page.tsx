"use client";

import { useEffect, useMemo, useState } from "react";
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
      start: () => go({ t: "host:start" }),
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
  if (state.error && ["bad_code", "bad_secret", "session_ended"].includes(state.error)) {
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

  return (
    <main className="p-stage">
      <div className="p-top">
        <span className="title">{snap.meta.title}</span>
        {phase === "live" && slide && <span className="p-idx">{snap.currentSlideIdx + 1} / {snap.slides.length}</span>}
        <span className="spacer" />
        {phase !== "ended" && (
          <span className="s-chip p-chip-code">{playHost} · <b className="h-code">{snap.meta.code}</b></span>
        )}
      </div>

      <section className="p-main" key={`${phase}-${snap.currentSlideIdx}-${revealed}`}>
        {phase === "lobby" && (
          <Lobby code={snap.meta.code} playHost={playHost} participants={participants} onStart={actions.start} canStart={snap.slides.length > 0} />
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
            </div>
            {revealed && isGame && <Leaderboard entries={state.reveal?.leaderboard ?? state.leaderboard} />}
          </div>
        )}

        {phase === "ended" && (
          <div style={{ display: "grid", gap: 48 }}>
            <h1 className="p-question" style={{ textAlign: "center", margin: "0 auto" }}>{t("host.podium")}</h1>
            <Podium podium={state.podium ?? state.leaderboard.slice(0, 3)} />
            {state.leaderboard.length > 3 && <div className="p-rest"><Leaderboard entries={state.leaderboard.slice(3)} limit={50} title={t("host.allParticipants")} /></div>}
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

      {state.status !== "open" && (
        <div className="p-status s-chip s-pop">{state.status === "closed" ? t("common.disconnected") : t("common.reconnecting")}</div>
      )}
    </main>
  );
}
