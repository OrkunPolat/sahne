import { useEffect, useMemo, useState } from "react";
import type { TeamStanding } from "@sahne/protocol";
import { Avatar } from "@sahne/ui";
import { useI18n } from "../lib/i18n";
import { HOST_URL } from "../lib/env";
import { canvasToBlob, renderResultCard, shareCard } from "../lib/share";
import { TeamStandings } from "../components/TeamStandings";

interface Props {
  nickname: string;
  avatarSeed: string;
  rank: number | null;
  score: number | null;
  title: string;
  teamId: string | null;
  teamName: string | null;
  teams: TeamStanding[];
  publicToken: string | null;
  onLeave: () => void;
}

export function Ended({ nickname, avatarSeed, rank, score, title, teamId, teamName, teams, publicToken, onLeave }: Props) {
  const { t } = useI18n();
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null);
  const [canShare, setCanShare] = useState(false);

  // Kart: fontlar hazır olunca offscreen çiz (1080×1920), önizleme + paylaşım için PNG.
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const draw = async () => {
      try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }
      if (cancelled) return;
      try {
        const c = renderResultCard({
          appName: t("common.appName"), title, nickname, avatarSeed, rank, score,
          rankLabel: t("play.finalRank"), pointsLabel: t("common.points"),
          teamName, teamLabel: t("play.yourTeam"),
        });
        const blob = await canvasToBlob(c);
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ url, blob });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        try {
          setCanShare(typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [new File([blob], "sahne.png", { type: "image/png" })] }));
        } catch { setCanShare(false); }
      } catch { /* canvas yoksa kart yok */ }
    };
    void draw();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nickname, avatarSeed, rank, score, title, teamName]);

  const shareText = useMemo(() => t("play.shareText", { title, rank: rank ?? "-", score: score ?? 0 }), [t, title, rank, score]);
  const doShare = async () => { if (card) await shareCard(card.blob, shareText); };
  const resultsUrl = publicToken ? `${HOST_URL}/r/${publicToken}` : null;

  return (
    <div className="p-center s-fade-in">
      <div className="s-card s-card--glow p-result">
        <div className="p-label">{t("play.finalRank")}</div>
        {rank !== null ? <div className="p-rank-big s-pop">{rank}<sup>.</sup></div> : <div className="p-h2">{t("play.sessionOver")}</div>}
        {score !== null && <div className="p-result__points" style={{ fontSize: "1.6rem" }}>{score} {t("common.points")}</div>}
        <div className="p-avatar-wrap"><Avatar seed={avatarSeed} size={96} /></div>
        <div className="p-nick-big">{nickname}</div>
        {teamName && <span className="s-chip p-team-chip">{t("play.yourTeam")} · <strong>{teamName}</strong></span>}
        <div className="p-sub">{t("play.thanks")}</div>
      </div>

      <TeamStandings teams={teams} myTeamId={teamId} />

      {card && (
        <div className="s-card p-share s-fade-in">
          <img className="p-share__thumb" src={card.url} alt={t("play.shareCard")} width={54} height={96} />
          <div className="p-share__body">
            <div className="p-label">{t("play.shareCard")}</div>
            {canShare ? (
              <button type="button" className="s-btn s-btn--primary" onClick={doShare}>{t("play.share")}</button>
            ) : (
              <a className="s-btn s-btn--primary" href={card.url} download="sahne-sonuc.png">{t("play.download")}</a>
            )}
          </div>
        </div>
      )}

      {resultsUrl && (
        <a className="s-btn s-btn--lg p-btn-block" href={resultsUrl} target="_blank" rel="noopener noreferrer">{t("play.viewResults")} →</a>
      )}
      <button type="button" className="s-btn s-btn--ghost" onClick={onLeave}>{t("play.leave")}</button>
    </div>
  );
}
