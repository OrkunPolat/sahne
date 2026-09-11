"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/lib/providers";
import { createTournament, errText, saveOwned } from "@/lib/tournaments";
import { draftToInput, emptyDraft, TournamentForm, type Draft } from "@/components/tournament/TournamentForm";

export default function NewTournamentPage() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(d: Draft) {
    setBusy(true); setError(null);
    try {
      const r = await createTournament(draftToInput(d));
      saveOwned({ id: r.tournament.id, slug: r.tournament.slug, ownerSecret: r.ownerSecret, title: r.tournament.title, createdAt: Date.now() });
      router.push(`/t/${r.tournament.slug}`);
    } catch (e) {
      setError(errText(e)); setBusy(false);
    }
  }

  return (
    <main className="h-page t-page">
      <div className="t-head s-fade-in">
        <div>
          <p className="s-muted" style={{ marginBottom: 6 }}><Link href="/t" className="t-back">← {t("tournament.backToGallery")}</Link></p>
          <h1>{t("tournament.newTitle")}</h1>
        </div>
      </div>
      {error && <p className="h-error" role="alert">{error}</p>}
      <TournamentForm key={locale} initial={emptyDraft(locale)} submitLabel={t("tournament.createBtn")} busy={busy} onSubmit={onSubmit} />
    </main>
  );
}
