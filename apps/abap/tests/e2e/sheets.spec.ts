import { expect, test, type APIRequestContext } from "@playwright/test";

/** Development only: simulates editing cells in the spreadsheet (fixture source). */
async function editSheet(request: APIRequestContext, overrides: Record<string, Record<string, string>>) {
  const res = await request.post("/api/v1/dev/sheet-overrides", { data: { overrides } });
  expect(res.ok()).toBe(true);
}

test.describe.configure({ mode: "serial" });

test.describe("Feature: Google Sheets → app (criterion G)", () => {
  test("GIVEN automatic mode WHEN a cell changes and the dashboard reloads THEN the app shows the new value", async ({ page, request }) => {
    await page.goto("/sheets");
    await expect(page.getByTestId("sheet-source")).toContainText("Fixture local");
    await expect(page.getByRole("button", { name: /Automático ao abrir/ })).toHaveAttribute("aria-pressed", "true");

    await editSheet(request, { "ACT-08": { Owner: "Ana (planilha)", Status: "IN PROGRESS" } });
    await page.goto("/dashboard?sync=1");
    await expect(page.getByTestId("sync-banner")).toContainText("2 alteração(ões) aplicada(s)");

    await page.goto("/activities/ACT-08");
    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("IN PROGRESS");
    await expect(page.getByText("Ana (planilha) · Medium · no due date")).toBeVisible();
    await expect(page.getByText(/sheet.owner A DEFINIR → Ana \(planilha\)/)).toBeVisible();
    await expect(page.getByText(/local-dev \(sheets auto\) · status.changed NOT STARTED → IN PROGRESS/)).toBeVisible();
  });

  test("GIVEN preview mode WHEN a cell changes THEN it is listed and applied only after clicking Aplicar", async ({ page, request }) => {
    await page.goto("/sheets");
    await page.getByRole("button", { name: /Prévia \+ Aplicar/ }).click();
    await expect(page.getByRole("button", { name: /Prévia \+ Aplicar/ })).toHaveAttribute("aria-pressed", "true");

    await editSheet(request, { "ACT-08": { Owner: "Ana (planilha)", Status: "IN PROGRESS" }, "ACT-09": { Priority: "High" } });
    await page.goto("/dashboard?sync=1");
    await expect(page.getByTestId("sync-banner")).toHaveCount(0); // preview mode never writes on open

    await page.goto("/sheets");
    const row = page.getByRole("row", { name: /ACT-09 Priority Medium High/ });
    await expect(row).toBeVisible();
    await page.getByRole("button", { name: "Aplicar no app" }).click();
    await expect(page.getByTestId("apply-result")).toContainText("1 alteração(ões) aplicada(s)");
    await page.goto("/activities/ACT-09");
    await expect(page.getByText(/Medium|High/).first()).toBeVisible();
    await expect(page.getByText(/A DEFINIR · High/)).toBeVisible();

    // Restore the default for other tests.
    await page.goto("/sheets");
    await page.getByRole("button", { name: /Automático ao abrir/ }).click();
    await expect(page.getByRole("button", { name: /Automático ao abrir/ })).toHaveAttribute("aria-pressed", "true");
  });

  test("invalid cells are reported, not applied", async ({ page, request }) => {
    await editSheet(request, { "ACT-10": { Status: "FINISHED" } });
    await page.goto("/sheets");
    await expect(page.getByTestId("sheet-issues")).toContainText("ACT-10 · Status “FINISHED”");
    await page.goto("/activities/ACT-10");
    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("NOT STARTED");
  });
});

test("development shows the local mode instead of a login", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/); // already "signed in" as local-dev
  await expect(page.getByTestId("current-user")).toHaveText("modo local (sem login)");
  await page.goto("/settings");
  await expect(page.getByText("Modo local sem login (desenvolvimento)")).toBeVisible();
});
