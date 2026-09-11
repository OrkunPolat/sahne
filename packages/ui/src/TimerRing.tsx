import { useEffect, useState } from "react";

/** Sunucu zamanına göre geri sayım halkası. startedAt/serverNow epoch ms; offset istemci-sunucu farkı. */
export function TimerRing({ startedAt, limitS, clockOffset = 0, size = 72 }: { startedAt: number; limitS: number; clockOffset?: number; size?: number }) {
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + clockOffset), 100);
    return () => clearInterval(id);
  }, [clockOffset]);
  const elapsed = Math.max(0, now - startedAt);
  const remain = Math.max(0, limitS * 1000 - elapsed);
  const p = remain / (limitS * 1000);
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg className="s-ring" viewBox="0 0 72 72" width={size} height={size} role="timer" aria-label={`${Math.ceil(remain / 1000)}`}>
      <circle className="track" cx="36" cy="36" r={r} />
      <circle className="bar" cx="36" cy="36" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
      <text x="36" y="41" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor" fontFamily="var(--font-display)">
        {Math.ceil(remain / 1000)}
      </text>
    </svg>
  );
}
