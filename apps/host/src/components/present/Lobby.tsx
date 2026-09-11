"use client";

import { Avatar } from "@sahne/ui";
import type { Participant, Team } from "@sahne/protocol";
import { teamHue } from "./TeamStandings";
import { useT } from "@/lib/providers";
import { JoinQr } from "@/components/JoinQr";
import { PLAY_URL } from "@/lib/api";

export function Lobby({ code, playHost, participants, teams = [], onStart, canStart }: { code: string; playHost: string; participants: Participant[]; teams?: Team[]; onStart: () => void; canStart: boolean }) {
  const t = useT();
  const grouped = teams.length > 0;
  const unassigned = participants.filter((p) => !p.teamId || !teams.some((tm) => tm.id === p.teamId));
  const person = (p: Participant) => (
    <span key={p.id} className={`s-card p-person s-pop${p.connected ? "" : " off"}`}>
      <Avatar seed={p.avatarSeed} size={36} />
      {p.nickname}
    </span>
  );
  return (
    <div className="p-lobby">
      <div className="s-card s-card--glow p-join">
        <div className="lead">{t("host.joinAt")}</div>
        <div className="url">{playHost}</div>
        <div className="lead">{t("host.enterCode")}</div>
        <div className="code">{code}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 18 }}>
          <JoinQr url={`${PLAY_URL}/?code=${code}`} size={180} />
          <div className="lead" style={{ maxWidth: 220 }}>{t("host.scanQr")}</div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="s-chip" style={{ fontSize: "1.1rem", padding: "10px 18px" }}>{t("common.participantsCount", { count: participants.length })}</span>
          <button type="button" className="s-btn s-btn--primary s-btn--lg" onClick={onStart} disabled={!canStart}>{t("common.start")} →</button>
        </div>
        {participants.length === 0 ? (
          <p className="p-waiting">{t("host.waitingForParticipants")}</p>
        ) : (
          grouped ? (
          <div className="p-team-groups">
            {teams.map((team) => {
              const members = participants.filter((p) => p.teamId === team.id);
              return (
                <div key={team.id} className="p-team-group">
                  <span className="p-team-chip" style={{ ["--team" as string]: `hsl(${teamHue(team.id)} 60% 55%)` }}>
                    <i /> {team.name} <b>{members.length}</b>
                  </span>
                  <div className="p-people">{members.map(person)}</div>
                </div>
              );
            })}
            {unassigned.length > 0 && (
              <div className="p-team-group">
                <span className="p-team-chip" style={{ ["--team" as string]: "var(--fg-muted)" }}><i /> {t("host.noTeam")}</span>
                <div className="p-people">{unassigned.map(person)}</div>
              </div>
            )}
          </div>
          ) : (
          <div className="p-people">{participants.map(person)}</div>
          )
        )}
      </div>
    </div>
  );
}
