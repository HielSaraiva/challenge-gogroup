import { test, expect, type Page } from "@playwright/test";
import { dailyPlan } from "./fixtures";

async function startPlan(page: Page) {
  await page.goto("/#overview");
  await page
    .getByRole("button", { name: "Preparar meu dia com IA", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preparar plano com IA", exact: true })
    .click();
}

const files = {
  "pedidos_excecao.csv": `order_id,customer_id,marca,data_pedido,valor,sku,descricao_produto,qtd_itens,brinde_no_pedido,tipo_excecao,status,transportadora,uf,cidade,data_prometida,data_entrega,maquina,turno,cd,lote_produto,data_abertura_excecao
IMPORT-1,IMPORT-C,Sintética,2026-09-01,100.00,SKU,Importação de teste,1,False,atraso_entrega,aberta,Sintética,SP,Teste,2026-09-04,,,manhã,CD1,L1,2026-09-08`,
  "clientes.csv": `customer_id,n_pedidos,receita_acumulada,data_primeiro_pedido,n_contatos_atendimento
IMPORT-C,1,100.00,2026-09-01,0`,
  "transportadoras.csv": `transportadora,uf_atendida,sla_contratado_dias_uteis,custo_medio_frete
Sintética,SP,3,12.00`,
};
async function previewImport(page: Page) {
  await page.goto("/#data");
  for (const [name, text] of Object.entries(files))
    await page
      .getByLabel(name, { exact: true })
      .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(text) });
  await page
    .getByRole("button", { name: "Validar arquivos", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Confirmar importação de 1 pedidos",
      exact: true,
    }),
  ).toBeVisible();
}

test("keeps a saved AI analysis successful and retries only the workspace read", async ({
  page,
}, info) => {
  let blocked = false;
  let analyses = 0;
  await page.route("**/api/workspace", async (route) => {
    if (blocked)
      await route.fulfill({
        status: 503,
        json: { error: "Falha sintética de atualização" },
      });
    else await route.continue();
  });
  await page.route("**/api/investigations", async (route) => {
    analyses++;
    const { requestId } = route.request().postDataJSON();
    expect(
      (await page.request.get("/api/browser-fixture?plan=1")).ok(),
    ).toBeTruthy();
    blocked = true;
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          investigation: {
            id: requestId,
            type: "daily",
            target: "day",
            status: "completed",
            summary: "Plano sintético salvo.",
            events: [],
            taskIds: [],
            planId: dailyPlan.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }) + "\n",
    });
  });
  await startPlan(page);
  await expect(
    page.getByRole("heading", {
      name: "Preparação do plano concluída",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Análise salva. Não foi possível atualizar a tela.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".alert-error")).toHaveCount(0);
  const recoveryButton = page.getByRole("button", {
    name: "Atualizar tela",
    exact: true,
  });
  expect(
    await recoveryButton.evaluate((el) =>
      parseFloat(getComputedStyle(el).borderTopWidth),
    ),
  ).toBeGreaterThan(0);
  if (page.viewportSize()!.width < 640) {
    const action = await recoveryButton.boundingBox();
    const alert = await recoveryButton.locator("..").boundingBox();
    expect(action!.width).toBeGreaterThan(alert!.width * 0.8);
  }
  await page.screenshot({
    path: info.outputPath("saved-analysis-refresh-pending.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Atualizar tela", exact: true })
    .click();
  await expect(
    page.getByText("Análise salva. Não foi possível atualizar a tela.", {
      exact: false,
    }),
  ).toBeVisible();
  blocked = false;
  await page
    .getByRole("button", { name: "Atualizar tela", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Seu plano de trabalho", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Atualizar tela", exact: true }),
  ).toHaveCount(0);
  expect(analyses).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Seu plano de trabalho", exact: true }),
  ).toBeVisible();
});

for (const transportError of [false, true]) {
  test(`preserves a real AI failure (${transportError ? "HTTP" : "agent result"})`, async ({
    page,
  }) => {
    await page.route("**/api/investigations", async (route) => {
      if (transportError) {
        await route.fulfill({
          status: 503,
          json: { error: "Provedor indisponível no teste." },
        });
      } else {
        const { requestId } = route.request().postDataJSON();
        await route.fulfill({
          json: {
            investigation: {
              id: requestId,
              type: "daily",
              target: "day",
              status: "failed",
              summary: "Provedor indisponível no teste.",
              events: [],
              taskIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }
    });
    await startPlan(page);
    await expect(
      page.getByRole("heading", { name: "Análise interrompida", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Análise salva.", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Seu plano de trabalho", exact: true }),
    ).toHaveCount(0);
  });
}

test("keeps an imported base saved and retries loading without importing again", async ({
  page,
}, info) => {
  let blocked = false;
  let commits = 0;
  await page.route("**/api/workspace", async (route) => {
    if (blocked)
      await route.fulfill({
        status: 503,
        json: { error: "Falha sintética de atualização" },
      });
    else await route.continue();
  });
  await page.route("**/api/data", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().mode === "commit"
    ) {
      commits++;
      const saved = await route.fetch();
      expect(saved.ok()).toBeTruthy();
      blocked = true;
      await route.fulfill({ response: saved });
    } else await route.continue();
  });
  await previewImport(page);
  await page
    .getByRole("button", {
      name: "Confirmar importação de 1 pedidos",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Base importada. Não foi possível carregar os novos dados.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/#data$/);
  await page.screenshot({
    path: info.outputPath("imported-base-refresh-pending.png"),
    fullPage: true,
    animations: "disabled",
  });
  await expect(page.locator(".alert-error")).toHaveCount(0);
  await expect(page.locator(".data-status")).toContainText(
    "1 pedidos na base atual",
  );
  await expect(
    page.getByRole("button", { name: "Confirmar importação", exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Tentar carregar novamente", exact: true })
    .click();
  await expect(page).toHaveURL(/#data$/);
  await expect(
    page.getByRole("button", {
      name: "Tentar carregar novamente",
      exact: true,
    }),
  ).toBeEnabled();
  blocked = false;
  await page
    .getByRole("button", { name: "Tentar carregar novamente", exact: true })
    .click();
  await expect(page).toHaveURL(/#overview$/);
  await expect(page.locator(".portfolio-summary dd").first()).toHaveText("1");
  await expect(page.locator(".alert-error")).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/workspace")).json()).orders.map(
      (order: { id: string }) => order.id,
    ),
  ).toEqual(["IMPORT-1"]);
  await page.reload();
  await expect(page.locator(".portfolio-summary dd").first()).toHaveText("1");
  expect(commits).toBe(1);
});

test("shows a rejected import as an error and keeps the previous base", async ({
  page,
}) => {
  await page.route("**/api/data", async (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().postDataJSON().mode === "commit"
    )
      await route.fulfill({
        status: 409,
        json: { error: "Importação recusada no teste." },
      });
    else await route.continue();
  });
  await previewImport(page);
  await page
    .getByRole("button", {
      name: "Confirmar importação de 1 pedidos",
      exact: true,
    })
    .click();
  await expect(page.locator(".data-workspace .alert-error")).toHaveText(
    "Importação recusada no teste.",
  );
  await expect(page.locator(".data-status")).toContainText(
    "25 pedidos na base atual",
  );
  await expect(
    page.getByRole("button", {
      name: "Tentar carregar novamente",
      exact: true,
    }),
  ).toHaveCount(0);
});
