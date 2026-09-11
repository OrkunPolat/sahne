"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createSession, putSlides } from "@/lib/api";
import { saveToRegistry } from "@/lib/registry";
import { templatesFor, type TemplateId } from "@/lib/templates";
import { useLocale, useT } from "@/lib/providers";

export function TemplateGallery() {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<TemplateId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const templates = templatesFor(locale);

  async function use(id: TemplateId) {
    const tpl = templates.find((x) => x.id === id);
    if (!tpl || busy) return;
    setBusy(id); setError(null);
    try {
      const slides = tpl.build().map((s, idx) => ({ ...s, idx }));
      const s = await createSession({ title: tpl.title, localeDefault: locale });
      saveToRegistry({ id: s.id, code: s.code, title: s.title, hostSecret: s.hostSecret, createdAt: Date.now() });
      await putSlides(s.id, s.hostSecret, slides);
      router.push(`/s/${s.id}/edit`);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
      setBusy(null);
    }
  }

  return (
    <section className="h-section" id="templates">
      <h2>{t("host.templatesTitle")}</h2>
      <p className="s-muted h-section__lead">{t("host.templatesLead")}</p>
      {error && <p className="h-error" role="alert">{error}</p>}
      <div className="h-templates">
        {templates.map((tpl) => {
          const n = tpl.build().length;
          return (
            <button key={tpl.id} type="button" className="s-card h-template" onClick={() => use(tpl.id)} disabled={busy !== null} aria-busy={busy === tpl.id}>
              <span className="h-template__icon" aria-hidden>{tpl.icon}</span>
              <span className="h-template__body">
                <strong>{tpl.title}</strong>
                <span className="s-muted">{tpl.description}</span>
              </span>
              <span className="h-template__foot">
                <span className="s-chip">{t("host.templateSlides", { n })}</span>
                <span className="h-template__cta">{busy === tpl.id ? t("common.loading") : `${t("host.templateUse")} →`}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
