"use client";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { MAX_TEAMS, type SessionMeta, type Team } from "@sahne/protocol";
import { ApiError, putSettings } from "@/lib/api";
import { useT } from "@/lib/providers";
import { teamHue } from "@/components/present/TeamStandings";

/** Takım modu + seri anahtarı: PUT /api/sessions/:id/settings. Oturum canlıyken salt okunur. */
export function SettingsCard({ sessionId, secret, meta, readOnly, onSaved }: {
  sessionId: string; secret: string; meta: SessionMeta | null; readOnly: boolean; onSaved: (m: SessionMeta) => void;
}) {
  const t = useT();
  const defaults = t("host.teamDefaults").split(",");
  const [enabled, setEnabled] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [seriesKey, setSeriesKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) return;
    setEnabled(meta.teams.length > 0);
    setTeams(meta.teams);
    setSeriesKey(meta.seriesKey ?? "");
  }, [meta]);

  const makeTeams = (n: number): Team[] => Array.from({ length: n }, (_, i) => ({ id: nanoid(6), name: defaults[i] ?? t("host.teamName", { n: i + 1 }) }));

  function toggle(on: boolean) {
    setEnabled(on); setSaved(false);
    if (on && teams.length < 2) setTeams(makeTeams(2));
  }
  function rename(id: string, name: string) { setTeams((p) => p.map((x) => (x.id === id ? { ...x, name } : x))); setSaved(false); }
  function remove(id: string) { setTeams((p) => (p.length > 2 ? p.filter((x) => x.id !== id) : p)); setSaved(false); }
  function add() {
    setTeams((p) => (p.length >= MAX_TEAMS ? p : [...p, { id: nanoid(6), name: defaults[p.length] ?? t("host.teamName", { n: p.length + 1 }) }]));
    setSaved(false);
  }

  async function save() {
    setBusy(true); setError(null);
    try {
      const body = {
        teams: enabled ? teams.map((x) => ({ ...x, name: x.name.trim().slice(0, 24) || t("host.teamName", { n: 1 }) })) : [],
        seriesKey: seriesKey.trim().slice(0, 40) || null,
      };
      const r = await putSettings(sessionId, secret, body);
      onSaved(r.meta); setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally { setBusy(false); }
  }

  return (
    <div className="s-card h-settings">
      <div className="h-settings__head">
        <div>
          <strong>⚑ {t("host.teamsTitle")}</strong>
          <p className="s-muted">{t("host.teamsLead")}</p>
        </div>
        <label className="h-switch">
          <input type="checkbox" checked={enabled} disabled={readOnly} onChange={(e) => toggle(e.target.checked)} />
          <span>{t("host.teamsToggle")}</span>
        </label>
      </div>

      {enabled && (
        <div className="h-teams">
          {teams.map((team, i) => (
            <div key={team.id} className="h-option">
              <span className="h-team-dot" style={{ background: `hsl(${teamHue(team.id)} 60% 55%)` }} />
              <input className="s-input" value={team.name} maxLength={24} disabled={readOnly} placeholder={t("host.teamName", { n: i + 1 })} onChange={(e) => rename(team.id, e.target.value)} />
              <button type="button" className="h-icon" disabled={readOnly || teams.length <= 2} aria-label={t("common.delete")} onClick={() => remove(team.id)}>✕</button>
            </div>
          ))}
          {teams.length < MAX_TEAMS && !readOnly && (
            <button type="button" className="s-btn" style={{ justifySelf: "start" }} onClick={add}>+ {t("host.addTeam")}</button>
          )}
        </div>
      )}

      <label className="h-field">
        <span>{t("host.seriesKey")}</span>
        <input className="s-input" value={seriesKey} maxLength={40} disabled={readOnly} placeholder="haftalik-ekip" onChange={(e) => { setSeriesKey(e.target.value); setSaved(false); }} />
        <small className="s-muted">{t("host.seriesKeyHint")}</small>
      </label>

      {error && <div className="h-errors" role="alert">{error}</div>}
      {!readOnly && (
        <div className="h-actions" style={{ justifyContent: "flex-end", alignItems: "center" }}>
          {saved && <span className="s-chip">✓ {t("host.settingsSaved")}</span>}
          <button type="button" className="s-btn" onClick={save} disabled={busy || !meta}>{busy ? t("common.loading") : t("host.settingsSave")}</button>
        </div>
      )}
    </div>
  );
}
