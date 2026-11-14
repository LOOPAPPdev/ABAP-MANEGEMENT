import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Feature: interface template and project models (ADR-008)", () => {
  test("GIVEN a new project created with the template THEN DIAG-01 opens; answering stage E builds the AS-IS diagram", async ({ page }) => {
    await page.goto("/projects");
    await page.getByLabel("Código").fill("PRJ-08");
    await page.getByLabel("Nome do cliente").fill("Modelo E2E");
    await page.getByLabel(/Identificador/).fill("prj-08-modelo-e2e");
    await page.getByLabel(/Diagnóstico de processos/).check();
    await page.getByRole("button", { name: "Criar projeto" }).click();
    await expect(page).toHaveURL(/\/models\/DIAG-01/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Modelo E2E");
    await expect(page.getByText("1 de 18 campos")).toBeVisible();

    await page.getByRole("button", { name: /^E\s*Sequência/ }).click();
    await page.getByLabel(/etapas pela ordem/).fill("1. Receber pedido — Comercial\n2. Executar serviço — Operação\n3. Faturar — Financeiro");
    await page.getByRole("button", { name: "Salvar etapa" }).click();
    await expect(page.getByRole("status")).toContainText("Etapa E salva");
    await expect(page.getByText("2 de 18 campos")).toBeVisible();
    await expect(page.getByTestId("model-diagram").locator('[data-node-id="N_01"]')).toBeVisible();

    await page.getByRole("tab", { name: "Mermaid" }).click();
    await expect(page.getByTestId("mermaid")).toContainText('N_01["Receber pedido · Comercial"]');
    await page.getByRole("tab", { name: /Lacunas/ }).click();
    await expect(page.getByTestId("gaps")).toContainText("Obrigatório sem resposta");
    await page.getByRole("tab", { name: "Plano adaptativo" }).click();
    await expect(page.getByTestId("adaptive-plan").locator("li").first()).toContainText("obrigatório");
  });

  test("GIVEN the Models page WHEN a model JSON is pasted THEN it is imported into the current project only", async ({ page }) => {
    await page.goto("/models");
    // Fresh context = platform project, which does not have this client's DIAG-01.
    await expect(page.getByTestId("model-list")).not.toContainText("DIAG-01");
    await page.getByTestId("project-switch").selectOption("prj-08-modelo-e2e");
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/projects") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Abrir", exact: true }).first().click(),
    ]);
    await page.goto("/models");
    await expect(page.getByTestId("model-list")).toContainText("DIAG-01");
    const org = '{"id":"ORG-01","title":"Org E2E","company":"Modelo E2E","departments":[{"id":"A-X","name":"Área X","color":"red","members":[]}]}';
    await page.getByLabel("ou cole o JSON").fill(org);
    await page.getByRole("button", { name: "Importar" }).click();
    await expect(page).toHaveURL(/\/models\/ORG-01/);
    await expect(page.getByTestId("model-diagram")).toBeVisible();
    await page.goto("/models");
    await expect(page.getByTestId("model-list")).toContainText("ORG-01");
  });
});
