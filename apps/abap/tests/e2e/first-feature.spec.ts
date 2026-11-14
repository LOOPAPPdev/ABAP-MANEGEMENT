import { expect, test } from "@playwright/test";

test.describe("Feature: ACT-07 first vertical slice", () => {
  test("GIVEN ACT-01 WHEN set DONE without evidence THEN flagged; WHEN evidence added THEN progress is 7%", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("overall-progress")).toHaveText("0%");

    await page.goto("/activities/ACT-01");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ACT-01");
    await expect(page.getByText("Acceptance criterion")).toBeVisible();

    await page.getByLabel("Status").selectOption("DONE");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByTestId("activity-flag")).toContainText("NO EVIDENCE");
    await expect(page.getByRole("status")).toContainText("NO EVIDENCE");

    await page.goto("/dashboard");
    await expect(page.getByTestId("overall-progress")).toHaveText("0%");
    await expect(page.getByTestId("flag-list")).toContainText("ACT-01");

    await page.goto("/activities/ACT-01");
    await page.getByLabel("Kind").selectOption("file");
    await page.getByLabel(/Reference/).fill("docs/product/01_project-charter_v0.1.md");
    await page.getByRole("button", { name: "Add evidence" }).click();
    await expect(page.getByTestId("evidence-list")).toContainText("docs/product/01_project-charter_v0.1.md");
    await expect(page.getByTestId("effective-state")).toContainText("Effectively done");
    await expect(page.getByTestId("activity-flag")).toBeEmpty();

    await page.goto("/dashboard");
    await expect(page.getByTestId("overall-progress")).toHaveText("7%");
  });

  test("invalid evidence is rejected with a message", async ({ page }) => {
    await page.goto("/activities/ACT-02");
    await page.getByLabel("Kind").selectOption("commit");
    await page.getByLabel(/Reference/).fill("not-a-sha");
    await page.getByRole("button", { name: "Add evidence" }).click();
    await expect(page.getByRole("status")).toContainText("SHA");
    await expect(page.getByTestId("evidence-list")).toContainText("No evidence yet.");
  });
});

test.describe("Feature: progressive enhancement (no JavaScript)", () => {
  test.use({ javaScriptEnabled: false });

  // Regression: a native form POST (before hydration) must not be rejected by the CSRF origin check.
  test("GIVEN JavaScript is disabled WHEN the status form is submitted THEN the change is saved", async ({ page }) => {
    await page.goto("/activities/ACT-05");
    await page.getByLabel("Status").selectOption("PREPARED");
    await page.getByRole("button", { name: "Save status" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("ACT-05");
    await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("PREPARED");
  });
});
