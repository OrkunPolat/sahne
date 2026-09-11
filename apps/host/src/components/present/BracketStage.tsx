"use client";

import { useEffect, useRef } from "react";
import type { BracketState, Slide, Tally } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { sfx } from "@/lib/sound";
import { ChampionCard, Confetti, ItemCard, ProgressStrip, useRoundLabel } from "@/components/tournament/Matchup";

type BS = Extract<Slide, { type: "bracket" }>;

/**
 * Büyük ekran: canlı turnuva. Oylar slide:tally (choice, counts by itemId) ile gelir;
 * reveal sonrası kazanan `winner` (yeşil çerçeve), kaybeden `loser` (soluk).
 */
export function BracketStage({ slide, bracket, tally, revealed }: { slide: BS; bracket: BracketState | null; tally: Tally | null; revealed: boolean }) {
  const t = useT();
  const roundLabel = useRoundLabel();
  const items = bracket
    ? [...slide.items, ...(bracket.current ? [bracket.current.a, bracket.current.b] : []), ...(bracket.champion ? [bracket.champion] : [])]
    : slide.items;

  // Şampiyon belirlenince fanfar.
  const hadChampion = useRef(false);
  useEffect(() => {
    const has = !!bracket?.champion;
    if (has && !hadChampion.current) sfx.fanfare();
    hadChampion.current = has;
  }, [bracket?.champion]);

  if (!bracket) return <p className="p-waiting">{t("common.loading")}</p>;

  if (bracket.champion) {
    return (
      <div className="p-bracket p-bracket--champ">
        <Confetti count={64} />
        <ChampionCard item={bracket.champion} label={t("tournament.champion")} />
        <ProgressStrip results={bracket.results} items={items} size={bracket.size} />
      </div>
    );
  }

  // Reveal sonrası: sunucu `current`ı bir sonraki eşleşmeye ilerletir; gösterilecek olan son sonuçtur.
  const last = bracket.results[bracket.results.length - 1];
  const showResult = revealed && last;
  const byId = new Map(items.map((i) => [i.id, i]));
  const a = showResult ? byId.get(last.aId) ?? null : bracket.current?.a ?? null;
  const b = showResult ? byId.get(last.bId) ?? null : bracket.current?.b ?? null;
  const counts = tally?.kind === "choice" ? tally.counts : {};
  const va = showResult ? last.votesA : a ? counts[a.id] ?? 0 : 0;
  const vb = showResult ? last.votesB : b ? counts[b.id] ?? 0 : 0;
  const tot = Math.max(1, va + vb);
  const round = showResult ? last.round : bracket.round;
  // Reveal'da matchIdx ilerlemiş olabilir; gösterilen eşleşmenin sırası results'tan hesaplanır.
  const inRound = showResult ? bracket.results.filter((r) => r.round === last.round).length : bracket.matchIdx + 1;
  const matchesInRound = round / 2;
  if (!a || !b) return <p className="p-waiting">{t("common.loading")}</p>;
  const winner = showResult ? last.winnerId : null;

  return (
    <div className="p-bracket">
      <div className="p-bracket__head">
        <span className="p-bracket__round">{roundLabel(round)}</span>
        <span className="p-bracket__match s-muted">{t("tournament.presentMatch", { i: inRound, n: matchesInRound })}</span>
        <span className="spacer" />
        <span className="s-chip">{t("tournament.votes", { n: va + vb })}</span>
      </div>
      <div className="t-vs t-vs--present" key={`${round}-${inRound}`}>
        <ItemCard item={a} side="a" big votes={va} share={va / tot} state={winner ? (winner === a.id ? "winner" : "loser") : "idle"} />
        <div className="t-vs__badge" aria-hidden><span>VS</span></div>
        <ItemCard item={b} side="b" big votes={vb} share={vb / tot} state={winner ? (winner === b.id ? "winner" : "loser") : "idle"} />
      </div>
      <div className="p-bracket__strip">
        <span className="s-muted p-bracket__strip-label">{t("tournament.progress")} · {bracket.results.length}/{bracket.size - 1}</span>
        <ProgressStrip results={bracket.results} items={items} size={bracket.size} />
      </div>
    </div>
  );
}
