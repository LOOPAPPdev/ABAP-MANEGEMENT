import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const VIEWS = ["Infográfico", "Tutorial", "BPMN", "Organograma", "Diagrama complexo"];

async function open(page: Page, query = "") {
  await page.goto(`/canvas${query}`);
  await expect(page.locator('[data-component-id="canvas-workspace"]')).toHaveAttribute("data-hydrated", "true");
}

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const library = (page: Page) => page.getByRole("complementary", { name: "Biblioteca e estrutura" });

test.describe("Feature: Canvas Multiview (ADR-002 / ADR-003)", () => {
  test("GIVEN the canvas WHEN the user selects an activity THEN the Inspector shows its data and metanote", async ({ page }) => {
    await open(page);
    await page.locator('[data-node-id="ACT-03"]').click();
    await expect(page).toHaveURL(/node=ACT-03/);
    await expect(inspector(page).getByTestId("inspector-data")).toContainText("Escrever requisitos e critérios de aceite");
    await expect(inspector(page)).toContainText("ACT-02"); // dependency relation
    await inspector(page).getByRole("button", { name: /Metanota: Diagram node/ }).click();
    const note = inspector(page).getByTestId("metanote");
    await expect(note).toHaveAttribute("data-component", "diagram-node");
    for (const field of ["Nome", "Função", "Quando utilizar", "Dados necessários", "Interação", "Estado", "Regra de UX"])
      await expect(note).toContainText(field);
  });

  test("GIVEN an expanded sidebar WHEN it is collapsed THEN the canvas uses the free space", async ({ page }) => {
    await open(page);
    const area = page.getByTestId("canvas-area");
    const before = (await area.boundingBox())!.width;
    await page.getByRole("button", { name: "Recolher biblioteca" }).click();
    await expect(page.getByRole("button", { name: "Expandir biblioteca" })).toBeVisible();
    await expect.poll(async () => (await area.boundingBox())!.width).toBeGreaterThan(before + 100);
  });

  test("GIVEN a selection WHEN the user switches through all five views THEN data and selection stay consistent", async ({ page }) => {
    await open(page, "?node=ACT-03");
    const outlineCount = await library(page).getByTestId("outline").getByRole("button").count();
    expect(outlineCount).toBe(21); // project + 6 areas + 14 activities
    for (const v of VIEWS) {
      await page.getByRole("radio", { name: v }).click();
      await expect(page.getByRole("radio", { name: v })).toHaveAttribute("aria-checked", "true");
      await expect(page).toHaveURL(/node=ACT-03/);
      await expect(inspector(page).getByTestId("inspector-data")).toContainText("Escrever requisitos e critérios de aceite");
      expect(await library(page).getByTestId("outline").getByRole("button").count()).toBe(outlineCount);
    }
    // Org chart has no people for this dataset: warning + alternative representation.
    await page.getByRole("radio", { name: "Organograma" }).click();
    await expect(page.getByTestId("canvas-notes")).toContainText("Sem dados de pessoas");
  });

  test("GIVEN a project model (flow) THEN it is a Canvas dataset with its status and the tutorial follows its steps", async ({ page, request }) => {
    const flow = JSON.parse(readFileSync("tests/fixtures/flow.sample.json", "utf8"));
    const res = await request.post("/api/v1/projects/default/models", { data: { import: flow, source: "e2e", replace: true } });
    expect(res.ok()).toBe(true);
    await open(page);
    await page.locator("#dataset").selectOption("FLW-01");
    await expect(page.getByTestId("canvas-notes")).toContainText("rascunho");
    await expect(page.getByTestId("canvas-notes")).toContainText("AS-IS");
    await page.getByRole("radio", { name: "Tutorial" }).click();
    await expect(page.getByTestId("tutorial-position")).toContainText("Etapa 1 de 8");
    await page.getByRole("button", { name: "Próximo" }).click();
    await expect(page.getByTestId("tutorial-position")).toContainText("Etapa 2 de 8");
    await page.getByRole("button", { name: "Reiniciar" }).click();
    await expect(page.getByTestId("tutorial-position")).toContainText("Etapa 1 de 8");
  });

  test("the view toggle and the nodes are keyboard operable", async ({ page }) => {
    await open(page);
    await page.getByRole("radio", { name: "Diagrama complexo" }).focus();
    await page.keyboard.press("ArrowLeft");
    // Radix moves roving focus one tick after the key event: wait for it, as a user would.
    await expect(page.getByRole("radio", { name: "Organograma" })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio", { name: "Organograma" })).toHaveAttribute("aria-checked", "true");
    await page.locator('[data-node-id="AREA:Design"]').focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/node=AREA%3ADesign|node=AREA:Design/);
  });
});

test.describe("Feature: component showcase (ADR-004)", () => {
  test("lists every adopted component with an example area and a metanote", async ({ page }) => {
    await page.goto("/showcase");
    await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
    await expect(page.getByTestId("showcase-entry")).toHaveCount(44);
    for (const fam of ["Foundations", "Primitives", "Composites", "Layouts", "Diagrams", "Patterns"])
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${fam}`) })).toBeVisible();
  });
});
