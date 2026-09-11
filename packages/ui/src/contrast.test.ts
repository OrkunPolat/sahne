import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** WCAG 2.x kontrast: metin 4.5:1 (AA), UI bileşeni / büyük metin 3:1. */
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function luminance([r, g, b]: [number, number, number]) {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

function hue(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

/** Tema bloklarını çıkar: [data-theme="x"] { --a: #...; } */
function parseThemes(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  const re = /\[data-theme="([a-z-]+)"\]\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const vars: Record<string, string> = {};
    for (const [, k, v] of m[2]!.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) vars[k!] = v!;
    out[m[1]!] = { ...(out[m[1]!] ?? {}), ...vars };
  }
  return out;
}

const themes = parseThemes();
const THEME_IDS = ["midnight-gold", "obsidian-neon", "cream-forest", "burgundy-champagne"];

describe("theme tokens", () => {
  it("all four themes are defined with hex tokens", () => {
    expect(Object.keys(themes).sort()).toEqual([...THEME_IDS].sort());
  });
});

describe.each(THEME_IDS)("contrast · %s", (id) => {
  const t = themes[id]!;
  it("fg on bg ≥ 4.5 (AA text)", () => {
    expect(contrast(t.fg!, t.bg!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t.fg!, t["bg-elevated"]!)).toBeGreaterThanOrEqual(4.5);
  });
  it("fg-muted on bg ≥ 4.5", () => {
    expect(contrast(t["fg-muted"]!, t.bg!)).toBeGreaterThanOrEqual(4.5);
  });
  it("accent-fg on accent ≥ 4.5 (primary button)", () => {
    expect(contrast(t["accent-fg"]!, t.accent!)).toBeGreaterThanOrEqual(4.5);
  });
  it("accent on bg ≥ 3 (timer ring, chips)", () => {
    expect(contrast(t.accent!, t.bg!)).toBeGreaterThanOrEqual(3);
  });
  for (const n of [1, 2, 3, 4]) {
    it(`answer-${n}: label ≥ 4.5, tile vs bg ≥ 3`, () => {
      expect(contrast(t[`answer-${n}-fg`]!, t[`answer-${n}`]!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t[`answer-${n}`]!, t.bg!)).toBeGreaterThanOrEqual(3);
    });
  }
  it("answer tiles differ in hue ≥ 40° (shapes cover the rest)", () => {
    for (let a = 1; a <= 4; a++) for (let b = a + 1; b <= 4; b++) {
      const d = Math.abs(hue(t[`answer-${a}`]!) - hue(t[`answer-${b}`]!));
      expect(Math.min(d, 360 - d), `answer-${a} vs answer-${b}`).toBeGreaterThanOrEqual(40);
    }
  });
});
