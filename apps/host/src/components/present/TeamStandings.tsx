"use client";
import type { TeamStanding } from "@sahne/protocol";
import { useT } from "@/lib/providers";

/** Takım rengi: id'den deterministik ton; lobi, sıralama, podyum ve editör aynı rengi görür. */
export function teamHue(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  // Kısa/benzer id'ler (t1, t2…) için son karıştırma; aksi halde düşük bitler yakın tonlar verir.
  h >>>= 0; h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b) >>> 0; h ^= h >>> 16;
  return (h >>> 0) % 360;
}

/** Takım sıralaması: ort. puan + sıra değişimi. Bireysel tablonun yanında/altında. */
export function TeamStandings({ teams, title }: { teams: TeamStanding[]; title?: string }) {
  const t = useT();
  if (teams.length === 0) return null;
  const sorted = [...teams].sort((a, b) => a.rank - b.rank);
  const max = Math.max(1, ...sorted.map((x) => x.avgScore));
  return (
    <div className="s-card p-lb p-teams">
      <h3>{title ?? t("host.teamStandings")}</h3>
      {sorted.map((tm) => {
        const d = tm.rankDelta;
        return (
          <div key={tm.teamId} className={`p-team-row${tm.rank === 1 ? " top" : ""} s-pop`}>
            <span className="rank">{tm.rank}</span>
            <span className="p-team-dot" style={{ background: `hsl(${teamHue(tm.teamId)} 60% 55%)` }} />
            <span className="name">{tm.name} <small className="s-muted">{t("host.members", { n: tm.members })}</small></span>
            <span className={`delta ${d > 0 ? "up" : d < 0 ? "down" : "same"}`}>{d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : "–"}</span>
            <span className="score">{Math.round(tm.avgScore)} <small className="s-muted">{t("host.avgScore")}</small></span>
            <span className="p-bar"><i style={{ width: `${(tm.avgScore / max) * 100}%`, background: `hsl(${teamHue(tm.teamId)} 60% 55%)` }} /></span>
          </div>
        );
      })}
    </div>
  );
}

/** Oturum sonu takım podyumu: 2 · 1 · 3, bireysel podyumla aynı ritim. */
export function TeamPodium({ teams }: { teams: TeamStanding[] }) {
  const t = useT();
  const byRank = (r: number) => teams.find((e) => e.rank === r);
  const slots = [{ e: byRank(2), delay: 500 }, { e: byRank(1), delay: 1000 }, { e: byRank(3), delay: 0 }];
  return (
    <div className="p-podium p-podium--teams">
      {slots.map(({ e, delay }, i) => (
        <div key={i} className="p-podium-slot s-pop" style={{ animationDelay: `${delay}ms`, animationDuration: "700ms" }}>
          {e ? (
            <>
              <span className="p-team-dot p-team-dot--big" style={{ background: `hsl(${teamHue(e.teamId)} 60% 55%)` }} />
              <div className="name">{e.name}</div>
              <div className="score">{Math.round(e.avgScore)} {t("common.points")} · {t("host.members", { n: e.members })}</div>
              <div className="block">{e.rank}</div>
            </>
          ) : <div className="block" style={{ opacity: 0.3 }} />}
        </div>
      ))}
    </div>
  );
}
