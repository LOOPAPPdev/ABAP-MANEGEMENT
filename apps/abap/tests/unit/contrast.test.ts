import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** WCAG 2.2 contrast of the token pairs used for text (SC 1.4.3: ≥ 4.5:1 normal text). */
const css = readFileSync("app/app.css", "utf8");
const v = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))![1]!;
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
  ["muted-foreground", "muted", "NOT STARTED badge"],
  ["secondary-foreground", "muted", "table header"],
  ["brand-fg", "brand-tint", "IN PROGRESS / PREPARED badge, active nav"],
  ["brand-fg", "brand-tint-2", "IN REVIEW / APPROVED badge"],
  ["primary-foreground", "primary", "VERIFIED badge, primary button"],
  ["card", "foreground", "DONE badge"],
  ["destructive-foreground", "destructive", "BLOCKED badge"],
  ["destructive", "card", "flag text, errors"],
  ["primary", "card", "links"],
  ["primary", "background", "links on page"],
];

describe("Feature: WCAG contrast of token pairs (ADR-004 G5)", () => {
  it.each(PAIRS)("%s on %s (%s) ≥ 4.5:1", (fg, bg) => {
    expect(contrast(v(fg), v(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
