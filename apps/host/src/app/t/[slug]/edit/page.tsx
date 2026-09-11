"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { Tournament } from "@sahne/protocol";
import { useT } from "@/lib/providers";
import { deleteTournament, errText, findOwnedBySlug, getTournament, removeOwned, saveOwned, updateTournament } from "@/lib/tournaments";
import { draftFromTournament, draftToInput, TournamentForm, type Draft } from "@/components/tournament/TournamentForm";

export default function EditTournamentPage() {
  return <Suspense fallback={<main className="h-page t-page"><div className="h-empty"><span className="h-spinner h-spinner--lg" /></div></main>}><EditInner /></Suspense>;
}

function EditInner() {
  const { slug } = useParams<{ slug: string }>();
  const qs = useSearchParams();
  const router = useRouter();
  const t = useT();
  const [secret, setSecret] = useState<string | null | undefined>(undefined);
  const [tn, setTn] = useState<Tournament | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fromQs = qs.get("secret");
    setSecret(fromQs || findOwnedBySlug(slug)?.ownerSecret || null);
  }, [slug, qs]);

  useEffect(() => {
    let alive = true;
    getTournament(slug).then((r) => { if (alive) setTn(r.tournament); }).catch((e: unknown) => { if (alive) setError(errText(e)); });
    return () => { alive = false; };
  }, [slug]);

  // ?secret= ile gelindiyse kaydı tarayıcıya yaz; sonraki ziyaretlerde "Düzenle" görünsün.
  useEffect(() => {
    if (tn && secret && qs.get("secret")) saveOwned({ id: tn.id, slug: tn.slug, ownerSecret: secret, title: tn.title, createdAt: tn.createdAt });
  }, [tn, secret, qs]);

  async function onSubmit(d: Draft) {
    if (!tn || !secret) return;
    setBusy(true); setError(null); setSaved(false);
    try {
      const r = await updateTournament(tn.id, secret, draftToInput(d));
      saveOwned({ id: r.tournament.id, slug: r.tournament.slug, ownerSecret: secret, title: r.tournament.title, createdAt: r.tournament.createdAt });
      setSaved(true);
      if (r.tournament.slug !== slug) router.replace(`/t/${r.tournament.slug}/edit`);
      else setTn(r.tournament);
    } catch (e) { setError(errText(e)); } finally { setBusy(false); }
  }

  async function onDelete() {
    if (!tn || !secret || !window.confirm(t("tournament.confirmDelete"))) return;
    setBusy(true); setError(null);
    try {
      await deleteTournament(tn.id, secret);
      removeOwned(tn.id);
      router.push("/t");
    } catch (e) { setError(errText(e)); setBusy(false); }
  }

  if (secret === undefined || (!tn && !error)) return <main className="h-page t-page"><div className="h-empty"><span className="h-spinner h-spinner--lg" /></div></main>;
  if (secret === null || !tn) {
    return (
      <main className="h-page t-page">
        <div className="s-card h-notice"><p>{error ?? t("tournament.noAccess")}</p><Link className="s-btn" href={`/t/${slug}`}>← {t("common.prev")}</Link></div>
      </main>
    );
  }

  return (
    <main className="h-page t-page">
      <div className="t-head s-fade-in">
        <div>
          <p className="s-muted" style={{ marginBottom: 6 }}><Link href={`/t/${tn.slug}`} className="t-back">← {tn.title}</Link></p>
          <h1>{t("tournament.editTitle")}</h1>
        </div>
        {saved && <span className="s-chip">✓ {t("host.saved")}</span>}
      </div>
      {error && <p className="h-error" role="alert">{error}</p>}
      <TournamentForm
        key={tn.id}
        initial={draftFromTournament(tn)}
        submitLabel={t("tournament.saveBtn")}
        busy={busy}
        onSubmit={onSubmit}
        footer={<button type="button" className="s-btn s-btn--ghost t-danger" disabled={busy} onClick={onDelete}>🗑 {t("tournament.deleteBtn")}</button>}
      />
    </main>
  );
}
