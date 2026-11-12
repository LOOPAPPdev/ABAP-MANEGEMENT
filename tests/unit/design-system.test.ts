import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { registry, registrySchema } from "~/design-system";

const tokens = JSON.parse(readFileSync("docs/design-system/DESIGN_TOKENS.json", "utf8"));
const css = readFileSync("app/app.css", "utf8");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

function cssTokens(node: unknown, out: { css: string; value: string }[] = []) {
  if (node && typeof node === "object") {
    const n = node as Record<string, unknown>;
    if (typeof n.css === "string" && typeof n.$value === "string" && n.$type === "color") out.push({ css: n.css, value: n.$value });
    for (const v of Object.values(n)) cssTokens(v, out);
  }
  return out;
}

describe("Feature: design system registry (ADR-004 G3/G4)", () => {
  it("the registry JSON is valid and IDs are unique", () => {
    expect(registrySchema.safeParse(registry).success).toBe(true);
  });

  it("every adopted component has a 7-field metanote", () => {
    for (const c of registry.components.filter((x) => x.status === "adopted")) {
      expect(c.metanote, c.id).toBeDefined();
      expect(Object.values(c.metanote!).every((v) => v.length > 0), c.id).toBe(true);
    }
  });

  it("covers all six families with adopted components", () => {
    const families = new Set(registry.components.filter((c) => c.status === "adopted").map((c) => c.family));
    expect([...families].sort()).toEqual(["Composites", "Diagrams", "Foundations", "Layouts", "Patterns", "Primitives"]);
  });

  it("catalogues the 36 shadcn components that were not adopted", () => {
    expect(registry.components.filter((c) => c.id.startsWith("shadcn-") && c.status === "available")).toHaveLength(36);
  });

  it("every data-component-id used in the UI exists in the registry", () => {
    const ids = new Set(registry.components.map((c) => c.id));
    const used = new Set<string>();
    for (const f of [...walk("app"), ...walk("src")]) {
      for (const m of readFileSync(f, "utf8").matchAll(/data-component-id="([a-z0-9-]+)"|componentId="([a-z0-9-]+)"/g)) used.add((m[1] ?? m[2])!);
    }
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter((id) => !ids.has(id))).toEqual([]);
  });
});

describe("Feature: design tokens stay in sync", () => {
  it("every colour token with a CSS variable has the same value in app/app.css", () => {
    const list = cssTokens(tokens);
    expect(list.length).toBe(13);
    for (const t of list) {
      const m = css.match(new RegExp(`${t.css}:\\s*(#[0-9a-fA-F]{6})`));
      expect(m?.[1]?.toLowerCase(), t.css).toBe(t.value.toLowerCase());
    }
  });
});
