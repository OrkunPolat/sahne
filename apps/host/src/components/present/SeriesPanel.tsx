"use client";
import { useEffect, useState } from "react";
import { getSeries, type SeriesEntry } from "@/lib/api";
import { useT } from "@/lib/providers";

/** Seri (kümülatif) tablo: GET /api/sessions/:id/series. seriesKey varsa oturum sonunda gösterilir. */
export function SeriesPanel({ sessionId, secret, seriesKey }: { sessionId: string; secret: string; seriesKey: string }) {
  const t = useT();
  const [data, setData] = useState<{ sessions: number; leaderboard: SeriesEntry[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    // session:ended sonrası DB yazımı asenkron; kısa bir gecikmeyle çek.
    const id = setTimeout(() => {
      getSeries(sessionId, secret).then((r) => { if (alive) setData(r); }).catch(() => { if (alive) setError(true); });
    }, 800);
    return () => { alive = false; clearTimeout(id); };
  }, [sessionId, secret]);
  if (error) return null;
  return (
    <div className="s-card p-lb p-series">
      <h3>📈 {t("host.seriesTitle")} · <code>{seriesKey}</code>{data && <span className="s-muted"> · {t("host.seriesSessions", { n: data.sessions })}</span>}</h3>
      {!data ? <p className="s-muted">{t("common.loading")}</p> : data.leaderboard.length === 0 ? <p className="s-muted">{t("host.seriesEmpty")}</p> : (
        <>
          <div className="p-series-row p-series-head s-muted"><span /><span /><span>{t("host.seriesTotal")}</span><span>{t("host.seriesPlayed")}</span><span>{t("host.seriesWins")}</span></div>
          {data.leaderboard.slice(0, 10).map((e, i) => (
            <div key={e.deviceId} className={`p-series-row${i < 3 ? " top" : ""}`}>
              <span className="rank">{i + 1}</span>
              <span className="name">{e.nickname}</span>
              <span className="score">{e.totalScore}</span>
              <span>{e.sessionsPlayed}</span>
              <span>{e.wins > 0 ? `🏆 ${e.wins}` : "–"}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
