"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { TournamentCard as Card } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { listTournaments } from "@/lib/tournaments";
import { TournamentCard } from "@/components/tournament/TournamentCard";

/** Anasayfa: en çok oynanan 6 turnuva. Sunucu yoksa/hata varsa sessizce gizlenir. */
export function PopularTournaments() {
  const t = useT();
  const [items, setItems] = useState<Card[] | null>(null);
  useEffect(() => {
    let alive = true;
    listTournaments({ sort: "popular", limit: 6 }).then((r) => { if (alive) setItems(r.items); }).catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);
  if (!items || items.length === 0) return null;
  return (
    <section className="h-section" id="tournaments">
      <div className="t-section-head">
        <div>
          <h2>{t("tournament.popularTitle")}</h2>
          <p className="s-muted h-section__lead" style={{ margin: 0 }}>{t("tournament.popularLead")}</p>
        </div>
        <Link href="/t" className="s-btn">{t("tournament.seeAll")} →</Link>
      </div>
      <div className="t-grid t-grid--strip">
        {items.map((c) => <TournamentCard key={c.id} card={c} compact />)}
      </div>
    </section>
  );
}
