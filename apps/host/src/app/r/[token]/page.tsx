"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Slide, Tally } from "@sahne/protocol";
import { useLocale, useT } from "@/lib/providers";
import { ApiError, getPublicResults, type PublicResults } from "@/lib/api";
import { Logo, SiteFooter } from "@/components/SiteHeader";
import { Leaderboard } from "@/components/present/Leaderboard";
import { TeamStandings } from "@/components/present/TeamStandings";
import { QaBoard } from "@/components/present/QaBoard";
import { ChoiceTiles, OpenCards, ScaleBars, TrueFalseTiles, WordCloud } from "@/components/present/TallyViews";
import { slideTypeKey } from "@/components/editor/slides";

/** Herkese açık sonuç sayfası: host secret gerekmez; yalnızca GET /api/public/:token/results. */
export default function PublicResultsPage() {
  const { token } = useParams<{ token: string }>();
  const t = useT();
  const [locale] = useLocale();
  const [data, setData] = useState<PublicResults | null>(null);
  const [error, setError] = useState<"notfound" | string | null>(null);

  useEffect(() => {
    let alive = true;
    getPublicResults(token)
      .then((r) => { if (alive) setData(r); })
      .catch((e: unknown) => { if (alive) setError(e instanceof ApiError && e.status === 404 ? "notfound" : e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)); });
    return () => { alive = false; };
  }, [token]);

  const endedAt = data?.endedAt ? new Date(data.endedAt) : null;

  return (
    <>
      <main className="h-page r-page">
        <header className="r-head s-fade-in">
          <Link href="/" className="h-brand"><Logo /> <span>{t("common.appName")}</span></Link>
          <Link href="/" className="s-btn s-btn--primary">{t("host.resultsCta")} →</Link>
        </header>

        {error ? (
          <div className="s-card h-notice" style={{ maxWidth: 560 }}>
            <p>{error === "notfound" ? t("host.resultsNotFound") : error}</p>
            <Link className="s-btn" href="/">{t("host.resultsCta")}</Link>
          </div>
        ) : !data ? (
          <p className="s-muted">{t("common.loading")}</p>
        ) : (
          <>
            <section className="r-title s-fade-in">
              <h1>{data.title}</h1>
              {endedAt && !Number.isNaN(endedAt.getTime()) && (
                <p className="s-muted">{t("host.resultsEndedAt", { date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(endedAt) })}</p>
              )}
            </section>

            {(data.leaderboard.length > 0 || data.teams.length > 0) && (
              <section className="r-boards">
                {data.leaderboard.length > 0 && <Leaderboard entries={data.leaderboard} limit={20} />}
                {data.teams.length > 0 && <TeamStandings teams={data.teams} />}
              </section>
            )}

            <section className="r-slides">
              {data.slides.map(({ slide, tally }, i) => (
                <article key={slide.id} className="s-card r-slide s-fade-in" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                  <header className="r-slide__head">
                    <span className="s-chip">{i + 1} · {t(slideTypeKey(slide.type))}</span>
                    {slide.type !== "title" && <span className="s-muted">{t("common.participantsCount", { count: tally.total })}</span>}
                  </header>
                  <h2>{slide.text}</h2>
                  {slide.type === "title" && slide.subtitle && <p className="s-muted">{slide.subtitle}</p>}
                  <SlideTally slide={slide} tally={tally} />
                </article>
              ))}
            </section>

            <section className="r-cta s-card s-card--glow">
              <h2>{t("host.heroTitle")} <span className="h-accent">{t("host.heroTitleAccent")}</span></h2>
              <p className="s-muted">{t("host.heroLead")}</p>
              <Link href="/" className="s-btn s-btn--primary s-btn--lg">{t("host.resultsCta")} →</Link>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

/** Sunum ekranındaki TallyViews'i yeniden kullanır; oyun slaytlarında doğru cevap slayttan türetilir. */
function SlideTally({ slide, tally }: { slide: Slide; tally: Tally }) {
  switch (slide.type) {
    case "multiple_choice":
      return <ChoiceTiles slide={slide} tally={tally} correct={slide.mode === "game" ? slide.correctOptionIds : null} showCounts />;
    case "true_false":
      return <TrueFalseTiles tally={tally} correct={slide.correct} showCounts />;
    case "word_cloud":
      return <WordCloud tally={tally} />;
    case "open_ended":
      return <OpenCards tally={tally} />;
    case "scale":
      return <ScaleBars slide={slide} tally={tally} />;
    case "qa":
      return <QaBoard tally={tally} />;
    default:
      return null;
  }
}
