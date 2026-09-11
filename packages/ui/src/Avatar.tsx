/** Seed'den üretilen soyut avatar: kütüphanesiz, deterministik. */
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function Avatar({ seed, size = 40 }: { seed: string; size?: number }) {
  const h = hash(seed);
  const hue = h % 360, hue2 = (hue + 60 + (h >> 8) % 120) % 360;
  const shape = (h >> 16) % 3;
  const el = shape === 0 ? <circle cx="20" cy="20" r="9" fill={`hsl(${hue2} 70% 60%)`} />
    : shape === 1 ? <rect x="11" y="11" width="18" height="18" rx="4" fill={`hsl(${hue2} 70% 60%)`} transform={`rotate(${(h >> 20) % 45} 20 20)`} />
    : <path d="M20 9l11 20H9z" fill={`hsl(${hue2} 70% 60%)`} />;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="20" fill={`hsl(${hue} 45% 35%)`} />
      {el}
    </svg>
  );
}
