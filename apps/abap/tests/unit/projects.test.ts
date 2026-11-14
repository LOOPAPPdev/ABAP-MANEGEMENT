import { describe, expect, it } from "vitest";
import { newProjectSchema, parseDriveFolderId, parseSpreadsheetId, projectIdSchema, slugFor } from "~/domain/projects";

const FOLDER = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("Feature: project identity", () => {
  it("accepts client slugs and the platform project", () => {
    expect(projectIdSchema.safeParse("prj-01-cleansea").success).toBe(true);
    expect(projectIdSchema.safeParse("default").success).toBe(true);
    expect(projectIdSchema.safeParse("PRJ-01-CleanSea").success).toBe(false);
    expect(projectIdSchema.safeParse("../etc").success).toBe(false);
  });
  it("requires the id to start with the code and reserves 'default'", () => {
    expect(newProjectSchema.safeParse({ code: "PRJ-02", name: "Acme", id: "prj-02-acme" }).success).toBe(true);
    expect(newProjectSchema.safeParse({ code: "PRJ-02", name: "Acme", id: "prj-03-acme" }).success).toBe(false);
    expect(newProjectSchema.safeParse({ code: "PRJ-02", name: "Acme", id: "default" }).success).toBe(false);
  });
  it("builds the same slug as tools/new-client.mjs", () => {
    expect(slugFor("PRJ-01", "Clean Sea Ação")).toBe("prj-01-clean-sea-acao");
  });
});

describe("Feature: Google link parsing", () => {
  it("extracts folder IDs from URLs or bare IDs", () => {
    expect(parseDriveFolderId(`https://drive.google.com/drive/folders/${FOLDER}?usp=sharing`)).toBe(FOLDER);
    expect(parseDriveFolderId(`https://drive.google.com/open?id=${FOLDER}`)).toBe(FOLDER);
    expect(parseDriveFolderId(FOLDER)).toBe(FOLDER);
    expect(parseDriveFolderId("https://example.com/x")).toBeNull();
  });
  it("extracts spreadsheet IDs", () => {
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${FOLDER}/edit#gid=0`)).toBe(FOLDER);
    expect(parseSpreadsheetId("nope")).toBeNull();
  });
});
