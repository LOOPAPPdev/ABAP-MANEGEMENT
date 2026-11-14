import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Feature: client projects (monorepo clients/<slug>)", () => {
  test("GIVEN a new client WHEN the project is created THEN it becomes current with its own 14 activities", async ({ page }) => {
    await page.goto("/projects");
    await page.getByLabel("Código").fill("PRJ-07");
    await page.getByLabel("Nome do cliente").fill("Teste E2E");
    await page.getByLabel(/Identificador/).fill("prj-07-teste-e2e");
    await page.getByRole("button", { name: "Criar projeto" }).click();
    await expect(page).toHaveURL(/created=1/);
    await expect(page.getByTestId("project-list")).toContainText("PRJ-07");
    await expect(page.getByTestId("project-switch")).toHaveValue("prj-07-teste-e2e");

    await page.goto("/activities");
    await expect(page.getByRole("row")).toHaveCount(15); // header + 14 activities
  });

  test("changes in one project do not appear in another", async ({ page }) => {
    // Each test starts with a fresh browser context (no project cookie): open the client project first.
    const open = async (id: string) => {
      await page.getByTestId("project-switch").selectOption(id);
      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/projects") && r.request().method() === "POST"),
        page.getByRole("button", { name: "Abrir", exact: true }).first().click(),
      ]);
      await page.waitForLoadState("load");
      await expect(page.getByTestId("project-switch")).toHaveValue(id);
    };
    await page.goto("/dashboard");
    await open("prj-07-teste-e2e");
    await page.goto("/activities/ACT-13");
    await page.getByLabel("Status").selectOption("IN PROGRESS");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("IN PROGRESS");

    // Switch to the platform project with the header switcher.
    await open("default");
    await page.goto("/activities/ACT-13");
    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("NOT STARTED");
  });

  test("links are validated and saved without showing raw IDs", async ({ page }) => {
    await page.goto("/projects");
    await page.getByLabel("Link da pasta do Google Drive").fill("https://example.com/not-drive");
    await page.getByRole("button", { name: "Salvar vínculos" }).click();
    await expect(page.getByRole("alert")).toContainText("Link da pasta do Drive inválido");
    await page.getByLabel("Link da pasta do Google Drive").fill("https://drive.google.com/drive/folders/1E2eFolderAbcdefghijklmnopqrstu");
    await page.getByRole("button", { name: "Salvar vínculos" }).click();
    await expect(page.getByRole("status")).toContainText("Vínculos salvos");
    await expect(page.getByText(/pasta do Drive vinculada/)).toBeVisible();
  });
});
