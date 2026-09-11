import { THEME_IDS, THEME_SWATCH, applyTheme, type ThemeId } from "./theme";

export function ThemeSwitcher({ value, onChange, labels }: { value: ThemeId; onChange: (t: ThemeId) => void; labels: Record<ThemeId, string> }) {
  return (
    <div role="radiogroup" style={{ display: "flex", gap: 8 }}>
      {THEME_IDS.map((t) => {
        const [bg, ac] = THEME_SWATCH[t];
        const active = t === value;
        return (
          <button
            key={t} type="button" role="radio" aria-checked={active} title={labels[t]} aria-label={labels[t]}
            onClick={() => { applyTheme(t); onChange(t); }}
            style={{
              width: 28, height: 28, borderRadius: 999, padding: 0, cursor: "pointer",
              background: `linear-gradient(135deg, ${bg} 50%, ${ac} 50%)`,
              border: active ? "2px solid var(--fg)" : "1px solid var(--border)",
              outline: active ? "3px solid var(--accent-soft)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}
