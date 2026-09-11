"use client";
import type { Tally } from "@sahne/protocol";
import { useT } from "@/lib/providers";

/** Canlı Soru-Cevap: oy sırasına göre kartlar; en üstteki büyük ve vurgulu. slide:tally kind=questions ile canlı güncellenir. */
export function QaBoard({ tally }: { tally: Tally | null }) {
  const t = useT();
  const qs = tally?.kind === "questions" ? [...tally.questions].sort((a, b) => b.votes - a.votes || a.at - b.at) : [];
  if (qs.length === 0) return <p className="p-waiting">{t("host.qaEmpty")}</p>;
  const [top, ...rest] = qs;
  return (
    <div className="p-qa">
      <div key={top!.id} className="s-card s-card--glow p-qa-card p-qa-card--top s-pop">
        <span className="p-qa-votes">▲ {top!.votes}</span>
        <p>{top!.text}</p>
        <span className="p-qa-by s-muted">— {top!.nickname}</span>
      </div>
      {rest.length > 0 && (
        <div className="p-qa-list">
          {rest.map((q) => (
            <div key={q.id} className="s-card p-qa-card s-pop">
              <span className="p-qa-votes">▲ {q.votes}</span>
              <p>{q.text}</p>
              <span className="p-qa-by s-muted">— {q.nickname}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
