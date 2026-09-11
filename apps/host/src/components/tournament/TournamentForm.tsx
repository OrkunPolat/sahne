"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { nanoid } from "nanoid";
import { maxBracketSize } from "@sahne/engine";
import { MAX_ITEMS, MIN_ITEMS, TOURNAMENT_CATEGORIES, type Locale, type Tournament, type TournamentCategory } from "@sahne/protocol";
import { LOCALES, LOCALE_LABELS } from "@sahne/i18n";
import { useT } from "@/lib/providers";
import { errText, uploadImage, type TournamentInput } from "@/lib/tournaments";

export type DraftItem = { id: string; name: string; imageUrl: string | null; uploading?: boolean; pasting?: boolean };
export type Draft = {
  title: string; description: string; category: TournamentCategory; locale: Locale; coverUrl: string | null;
  visibility: "public" | "unlisted"; items: DraftItem[];
};

export function draftFromTournament(tn: Tournament): Draft {
  return { title: tn.title, description: tn.description, category: tn.category, locale: tn.locale, coverUrl: tn.coverUrl, visibility: tn.visibility, items: tn.items.map((i) => ({ ...i })) };
}

export function emptyDraft(locale: Locale): Draft {
  return { title: "", description: "", category: "general", locale, coverUrl: null, visibility: "public", items: [] };
}

export function draftToInput(d: Draft): TournamentInput {
  return {
    title: d.title.trim(), description: d.description.trim(), category: d.category, locale: d.locale, coverUrl: d.coverUrl, visibility: d.visibility,
    items: d.items.map((i) => ({ id: i.id, name: i.name.trim(), imageUrl: i.imageUrl && /^https?:\/\//.test(i.imageUrl) ? i.imageUrl : null })),
  };
}

function ItemThumb({ url, name }: { url: string | null; name: string }) {
  if (!url) return <div className="t-thumb t-thumb--empty" aria-hidden>{name.trim().charAt(0).toUpperCase() || "·"}</div>;
  return <div className="t-thumb"><img src={url} alt="" loading="lazy" /></div>;
}

export function TournamentForm({
  initial, submitLabel, busy, onSubmit, footer,
}: {
  initial: Draft; submitLabel: string; busy: boolean; onSubmit: (d: Draft) => void; footer?: React.ReactNode;
}) {
  const t = useT();
  const [d, setD] = useState<Draft>(initial);
  const [bulk, setBulk] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const coverInput = useRef<HTMLInputElement>(null);
  const itemInput = useRef<HTMLInputElement>(null);
  const itemTarget = useRef<string | null>(null);

  const patch = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const patchItem = (id: string, p: Partial<DraftItem>) => setD((x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  async function setCover(file: File | undefined) {
    if (!file) return;
    setCoverBusy(true); setUploadError(null);
    try { patch({ coverUrl: await uploadImage(file) }); } catch (e) { setUploadError(errText(e)); } finally { setCoverBusy(false); }
  }
  function onDrop(e: DragEvent) {
    e.preventDefault(); setDragOver(false);
    void setCover(e.dataTransfer.files?.[0]);
  }

  async function setItemImage(id: string, file: File | undefined) {
    if (!file) return;
    patchItem(id, { uploading: true }); setUploadError(null);
    try { patchItem(id, { imageUrl: await uploadImage(file), uploading: false }); } catch (e) { setUploadError(errText(e)); patchItem(id, { uploading: false }); }
  }

  function addItems(names: string[]) {
    const fresh = names.map((n) => n.trim()).filter(Boolean).map((name) => ({ id: nanoid(8), name, imageUrl: null }));
    if (fresh.length === 0) return;
    setD((x) => ({ ...x, items: [...x.items, ...fresh].slice(0, MAX_ITEMS) }));
  }
  function move(id: string, dir: -1 | 1) {
    setD((x) => {
      const i = x.items.findIndex((it) => it.id === id); const j = i + dir;
      if (i < 0 || j < 0 || j >= x.items.length) return x;
      const items = [...x.items]; [items[i], items[j]] = [items[j]!, items[i]!];
      return { ...x, items };
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (d.title.trim().length < 2) errs.push(t("tournament.formTitle"));
    if (d.items.length < MIN_ITEMS) errs.push(t("tournament.minItems"));
    if (d.items.some((i) => !i.name.trim())) errs.push(t("tournament.itemNameRequired"));
    setErrors(errs);
    if (errs.length === 0) onSubmit(d);
  }

  const size = maxBracketSize(d.items.length);

  return (
    <form className="t-form" onSubmit={submit}>
      <div className="s-card t-form__card">
        <label className="h-field">
          <span>{t("tournament.formTitle")}</span>
          <input className="s-input" value={d.title} maxLength={80} required placeholder={t("tournament.formTitlePlaceholder")} onChange={(e) => patch({ title: e.target.value })} />
        </label>
        <label className="h-field">
          <span>{t("tournament.formDescription")}</span>
          <textarea className="s-input" rows={2} value={d.description} maxLength={300} placeholder={t("tournament.formDescriptionPlaceholder")} onChange={(e) => patch({ description: e.target.value })} />
        </label>
        <div className="h-row">
          <label className="h-field">
            <span>{t("tournament.formCategory")}</span>
            <select className="s-input h-select" value={d.category} onChange={(e) => patch({ category: e.target.value as TournamentCategory })}>
              {TOURNAMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`tournament.cat_${c}`)}</option>)}
            </select>
          </label>
          <label className="h-field">
            <span>{t("tournament.formLocale")}</span>
            <select className="s-input h-select" value={d.locale} onChange={(e) => patch({ locale: e.target.value as Locale })}>
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
            </select>
          </label>
          <label className="h-field">
            <span>{t("tournament.formVisibility")}</span>
            <select className="s-input h-select" value={d.visibility} onChange={(e) => patch({ visibility: e.target.value as Draft["visibility"] })}>
              <option value="public">{t("tournament.visPublic")}</option>
              <option value="unlisted">{t("tournament.visUnlisted")}</option>
            </select>
          </label>
        </div>

        <div className="h-field">
          <span>{t("tournament.cover")}</span>
          <div
            className={`t-drop${dragOver ? " t-drop--over" : ""}${d.coverUrl ? " t-drop--has" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
            onClick={() => coverInput.current?.click()} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); coverInput.current?.click(); } }}
          >
            {d.coverUrl ? <img src={d.coverUrl} alt="" /> : null}
            <div className="t-drop__label">
              {coverBusy ? <span className="h-spinner" /> : <span className="t-drop__icon" aria-hidden>⇪</span>}
              <span>{coverBusy ? t("tournament.uploading") : t("tournament.coverHint")}</span>
            </div>
          </div>
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { void setCover(e.target.files?.[0]); e.target.value = ""; }} />
          {d.coverUrl && (
            <button type="button" className="s-btn s-btn--ghost" style={{ justifySelf: "start" }} onClick={() => patch({ coverUrl: null })}>✕ {t("tournament.remove")}</button>
          )}
        </div>
      </div>

      <div className="s-card t-form__card">
        <div className="t-items__head">
          <h2>{t("tournament.itemsTitle")}</h2>
          <span className={`s-chip${d.items.length < MIN_ITEMS ? " t-chip--warn" : ""}`}>
            {t("tournament.itemsCount", { n: d.items.length })}{size > 0 && ` · ${t("tournament.bracketOf", { size })}`}
          </span>
        </div>

        <div className="t-items">
          {d.items.map((it, i) => (
            <div key={it.id} className="t-item">
              <span className="t-item__n">{i + 1}</span>
              <ItemThumb url={it.imageUrl} name={it.name} />
              <div className="t-item__fields">
                <input className="s-input" value={it.name} maxLength={60} placeholder={t("tournament.itemName")} onChange={(e) => patchItem(it.id, { name: e.target.value })} />
                {it.pasting ? (
                  <input className="s-input" autoFocus placeholder={t("tournament.imageUrlPlaceholder")} defaultValue={it.imageUrl ?? ""}
                    onBlur={(e) => patchItem(it.id, { imageUrl: e.target.value.trim() || null, pasting: false })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") patchItem(it.id, { pasting: false }); }} />
                ) : (
                  <div className="t-item__ops">
                    <button type="button" className="s-btn t-btn--sm" disabled={it.uploading} onClick={() => { itemTarget.current = it.id; itemInput.current?.click(); }}>
                      {it.uploading ? t("tournament.uploading") : `⇪ ${t("tournament.upload")}`}
                    </button>
                    <button type="button" className="s-btn t-btn--sm" onClick={() => patchItem(it.id, { pasting: true })}>🔗 {t("tournament.pasteUrl")}</button>
                    {it.imageUrl && <button type="button" className="s-btn s-btn--ghost t-btn--sm" onClick={() => patchItem(it.id, { imageUrl: null })}>✕ {t("tournament.itemImage")}</button>}
                  </div>
                )}
              </div>
              <span className="t-item__move">
                <button type="button" className="h-icon" disabled={i === 0} aria-label={t("tournament.moveUp")} onClick={() => move(it.id, -1)}>↑</button>
                <button type="button" className="h-icon" disabled={i === d.items.length - 1} aria-label={t("tournament.moveDown")} onClick={() => move(it.id, 1)}>↓</button>
                <button type="button" className="h-icon" aria-label={t("common.delete")} onClick={() => setD((x) => ({ ...x, items: x.items.filter((z) => z.id !== it.id) }))}>✕</button>
              </span>
            </div>
          ))}
        </div>
        <input ref={itemInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden
          onChange={(e) => { const id = itemTarget.current; if (id) void setItemImage(id, e.target.files?.[0]); e.target.value = ""; }} />

        <div className="t-items__add">
          <button type="button" className="s-btn" disabled={d.items.length >= MAX_ITEMS} onClick={() => addItems([""])}>+ {t("tournament.addItem")}</button>
        </div>

        <details className="t-bulk">
          <summary>{t("tournament.bulkAdd")}</summary>
          <textarea className="s-input" rows={5} value={bulk} placeholder={t("tournament.bulkPlaceholder")} onChange={(e) => setBulk(e.target.value)} />
          <button type="button" className="s-btn" disabled={!bulk.trim()} onClick={() => { addItems(bulk.split(/\r?\n/)); setBulk(""); }}>
            {t("tournament.bulkAddBtn")}
          </button>
        </details>
        {uploadError && <p className="h-error" role="alert">{t("tournament.uploadFailed")} {uploadError}</p>}
      </div>

      {errors.length > 0 && <div className="h-errors" role="alert">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}

      <div className="t-form__foot">
        {footer}
        <span className="spacer" />
        <button type="submit" className="s-btn s-btn--primary s-btn--lg" disabled={busy}>{busy ? t("common.loading") : submitLabel}</button>
      </div>
    </form>
  );
}
