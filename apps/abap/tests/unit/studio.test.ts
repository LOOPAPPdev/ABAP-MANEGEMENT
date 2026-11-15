import { describe, expect, it } from "vitest";
import { accessFor, artifactPathSchema, guestMayAccess, homeFor, publishSchema } from "~/domain/studio";

const STAFF = ["owner@example.com"];

describe("Feature: studio access rules (ADR-011)", () => {
  it("GIVEN an allow-listed e-mail THEN the person is staff, whatever the memberships", () => {
    expect(accessFor("Owner@Example.com", STAFF, [{ projectId: "prj-01-a", status: "invited" }])).toEqual({ kind: "staff" });
  });
  it("GIVEN invited or active memberships THEN the person is a guest of those projects only", () => {
    expect(accessFor("c@x.com", STAFF, [{ projectId: "prj-02-b", status: "active" }, { projectId: "prj-01-a", status: "invited" }, { projectId: "prj-03-c", status: "revoked" }])).toEqual({ kind: "guest", projects: ["prj-01-a", "prj-02-b"] });
  });
  it("GIVEN only revoked memberships THEN the person has no access", () => {
    expect(accessFor("c@x.com", STAFF, [{ projectId: "prj-01-a", status: "revoked" }])).toEqual({ kind: "none" });
  });
  it("GIVEN a guest WHEN they open governance, another project or write THEN access is denied", () => {
    const p = ["prj-01-a"];
    expect(guestMayAccess("GET", "/studio/prj-01-a", p)).toBe(true);
    expect(guestMayAccess("GET", "/api/v1/studio/prj-01-a", p)).toBe(true);
    expect(guestMayAccess("POST", "/auth/logout", p)).toBe(true);
    expect(guestMayAccess("GET", "/studio/prj-02-b", p)).toBe(false);
    expect(guestMayAccess("POST", "/studio/prj-01-a", p)).toBe(false);
    expect(guestMayAccess("POST", "/api/v1/studio/prj-01-a/members", p)).toBe(false);
    for (const path of ["/dashboard", "/activities", "/projects", "/settings", "/api/v1/projects", "/api/v1/activities", "/mcp", "/agent.zip", "/models"]) expect(guestMayAccess("GET", path, p), path).toBe(false);
  });
  it("sends a guest with one project straight to its studio", () => {
    expect(homeFor({ kind: "guest", projects: ["prj-01-a"] })).toBe("/studio/prj-01-a");
    expect(homeFor({ kind: "guest", projects: ["prj-01-a", "prj-02-b"] })).toBe("/studio");
    expect(homeFor({ kind: "staff" })).toBe("/dashboard");
  });
});

describe("Feature: artifact validation", () => {
  it("refuses path traversal and absolute paths", () => {
    for (const bad of ["../x.html", "a/../../x", "/etc/passwd", "a\\b.js", "./x.html", "a/", ""]) expect(artifactPathSchema.safeParse(bad).success, bad).toBe(false);
    for (const good of ["index.html", "_ds/design-system-1a/_ds_bundle.js", "Cleansea App.dc.html"]) expect(artifactPathSchema.safeParse(good).success, good).toBe(true);
  });
  it("requires an .html entry that is in the file list, allowed types and no duplicates", () => {
    const base = { slug: "prototipo", title: "Protótipo", notice: "Protótipo — dados simulados" };
    expect(publishSchema.safeParse({ ...base, entry: "index.html", files: [{ path: "index.html", content: "<p>x</p>" }] }).success).toBe(true);
    expect(publishSchema.safeParse({ ...base, entry: "app.js", files: [{ path: "app.js", content: "" }] }).success).toBe(false);
    expect(publishSchema.safeParse({ ...base, entry: "index.html", files: [{ path: "other.html", content: "" }] }).success).toBe(false);
    expect(publishSchema.safeParse({ ...base, entry: "index.html", files: [{ path: "index.html", content: "" }, { path: "x.exe", content: "" }] }).success).toBe(false);
    expect(publishSchema.safeParse({ ...base, entry: "index.html", files: [{ path: "index.html", content: "" }, { path: "index.html", content: "" }] }).success).toBe(false);
    expect(publishSchema.safeParse({ ...base, notice: "", entry: "index.html", files: [{ path: "index.html", content: "" }] }).success).toBe(false);
  });
});
