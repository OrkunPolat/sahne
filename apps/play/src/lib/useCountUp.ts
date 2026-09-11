import { useEffect, useState } from "react";

/** 0 → target sayım animasyonu. Reduced-motion veya gizli sekmede anında hedefe atlar (rAF arka planda durur). */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target === 0 || document.hidden) { setValue(target); return; }
    const start = performance.now();
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p >= 1) clearInterval(id);
    }, 1000 / 60);
    const onVis = () => { if (document.hidden) { setValue(target); clearInterval(id); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [target, durationMs]);
  return value;
}
