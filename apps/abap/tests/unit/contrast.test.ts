import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** WCAG 2.2 contrast of the token pairs used for text (SC 1.4.3: ≥ 4.5:1 normal text). */
const css = readFileSync("app/app.css", "utf8");
/** Reads a token's HSL channels ("0 0% 98%") from app.css and converts them to #rrggbb. */
const v = (name: string) => {
  const [h, s, l] = css.match(new RegExp(`--${name}:\\s*([^;]+);`))![1]!.trim().split(/\s+/).map((x) => parseFloat(x));
  const S = s! / 100, L = l! / 100;
  const k = (n: number) => (n + h! / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
export const contrast = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
};

const PAIRS: [string, string, string][] = [
  ["foreground", "background", "body text on page"],
  ["foreground", "card", "text on cards"],
  ["secondary-foreground", "card", "labels"],
  ["muted-foreground", "card", "support text on cards"],
  ["muted-foreground", "background", "support text on page"],
  ["secondary-foreground", "muted", "table header"],
  ["foreground", "sel-bg", "IN PROGRESS / PREPARED badge, active nav"],
  ["warn-fg", "warn-bg", "IN REVIEW / APPROVED badge, warnings"],
  ["foreground", "sel-border", "VERIFIED badge"],
  ["primary-foreground", "primary", "DONE badge, primary button"],
  ["destructive-foreground", "destructive-strong", "BLOCKED badge"],
  ["destructive-strong", "card", "flag text, errors"],
  ["destructive-strong", "background", "errors on page"],
  ["primary", "card", "links"],
  ["primary", "background", "links on page"],
];

describe("Feature: WCAG contrast of token pairs (ADR-004 G5, ADR-007 tokens)", () => {
  it.each(PAIRS)("%s on %s (%s) ≥ 4.5:1", (fg, bg) => {
    expect(contrast(v(fg), v(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
