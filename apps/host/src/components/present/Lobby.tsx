"use client";

import { Avatar } from "@sahne/ui";
import type { Participant } from "@sahne/protocol";
import { useT } from "@/lib/providers";

export function Lobby({ code, playHost, participants, onStart, canStart }: { code: string; playHost: string; participants: Participant[]; onStart: () => void; canStart: boolean }) {
  const t = useT();
  return (
    <div className="p-lobby">
      <div className="s-card s-card--glow p-join">
        <div className="lead">{t("host.joinAt")}</div>
        <div className="url">{playHost}</div>
        <div className="lead">{t("host.enterCode")}</div>
        <div className="code">{code}</div>
      </div>
      <div style={{ display: "grid", gap: 20, alignContent: "start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="s-chip" style={{ fontSize: "1.1rem", padding: "10px 18px" }}>{t("common.participantsCount", { count: participants.length })}</span>
          <button type="button" className="s-btn s-btn--primary s-btn--lg" onClick={onStart} disabled={!canStart}>{t("common.start")} →</button>
        </div>
        {participants.length === 0 ? (
          <p className="p-waiting">{t("host.waitingForParticipants")}</p>
        ) : (
          <div className="p-people">
            {participants.map((p) => (
              <span key={p.id} className={`s-card p-person s-pop${p.connected ? "" : " off"}`}>
                <Avatar seed={p.avatarSeed} size={36} />
                {p.nickname}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
