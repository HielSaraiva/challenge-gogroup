import { test, expect, type Page } from "@playwright/test";
async function seed(page: Page) {
  expect((await page.request.get("/api/browser-fixture")).ok()).toBeTruthy();
}
async function openOrder(page: Page) {
  await page.goto("/#queue");
  await page.getByLabel("Buscar pedidos", { exact: true }).fill("UI-A");
  await page
    .getByRole("button", {
      name: "Abrir pedido UI-A de Marca sintética",
      exact: true,
    })
    .click();
}
test.beforeEach(async ({ page }) => seed(page));

test("protects order edits, keyboard focus and discards only after confirmation", async ({
  page,
}) => {
  await openOrder(page);
  await expect(
    page.getByRole("heading", { name: "Pedido UI-A", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("textbox", { name: "Ação realizada", exact: true })
    .fill("Endereço conferido nos registros sintéticos.");
  await page
    .getByRole("textbox", { name: "Ação realizada", exact: true })
    .press("Tab");
  const unloading = page.waitForEvent("dialog");
  const reload = page.reload({ timeout: 1500 }).catch(() => {});
  const unsaved = await unloading;
  expect(unsaved.type()).toBe("beforeunload");
  await unsaved.dismiss();
  await reload;
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Há alterações não salvas" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continuar editando", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Ação realizada", exact: true }),
  ).toHaveValue("Endereço conferido nos registros sintéticos.");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Sair sem salvar alterações", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("confirms a saved execution even when the workspace refresh fails", async ({
  page,
}) => {
  await openOrder(page);
  await page
    .getByRole("textbox", { name: "Ação realizada", exact: true })
    .fill("Endereço conferido com a referência sintética.");
  await page
    .getByRole("textbox", {
      name: "Evidência ou referência da execução",
      exact: true,
    })
    .fill("Protocolo sintético de verificação cadastral.");
  await page
    .getByRole("combobox", {
      name: "A ação realizada resolveu a pendência deste pedido?",
      exact: true,
    })
    .selectOption("no");
  let patches = 0;
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() === "PATCH") patches++;
    await route.continue();
  });
  await page.route("**/api/workspace", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Falha sintética de atualização" },
    }),
  );
  const submit = page.getByRole("button", {
    name: "Registrar execução e manter aberto",
    exact: true,
  });
  await submit.click();
  await expect(
    page.getByRole("dialog").getByText("Registro salvo com sucesso."),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText(/Registro salvo\. A tela ainda/),
  ).toBeVisible();
  await expect(submit).toBeDisabled();
  expect(patches).toBe(1);
  await page.unroute("**/api/workspace");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Atualizar tela", exact: true })
    .click();
  await expect(
    page.getByText("Execução registrada", { exact: true }),
  ).toBeVisible();
});

test("records a recurrence conclusion without requiring a recommendation", async ({
  page,
}, info) => {
  await page.goto("/#insights");
  await page
    .getByRole("button", { name: "Abrir investigação", exact: true })
    .click();
  await page.getByRole("button", { name: "1. Pedidos", exact: true }).click();
  await page
    .getByLabel("Conferi os dados e as referências do pedido UI-0", {
      exact: true,
    })
    .check();
  await page
    .getByLabel("Conferi os dados e as referências do pedido UI-1", {
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "2. Registro", exact: true }).click();
  await page
    .getByRole("textbox", { name: "O que você verificou?", exact: true })
    .fill("A amostra foi conferida e ainda não permite confirmar a hipótese.");
  await page
    .getByRole("combobox", { name: "Resultado desta verificação", exact: true })
    .selectOption("inconclusiva");
  const nav = page.getByRole("navigation", { name: "Atalhos da investigação" });
  const bounds = await nav.boundingBox();
  const dialog = await page.getByRole("dialog").boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(dialog!.y);
  expect(bounds!.y).toBeLessThan(dialog!.y + 8);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: info.outputPath("recurrence-before-conclusion.png"),
  });
  await page.route("**/api/workspace", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Falha sintética após salvar conclusão" },
    }),
  );
  await page
    .getByRole("button", { name: "Registrar conclusão", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Conclusão da equipe" }),
  ).toBeVisible();
  await expect(page.getByText("Não informada", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("status")
      .filter({ hasText: "Registro salvo. A tela ainda" }),
  ).toBeVisible();
  await page.unroute("**/api/workspace");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Atualizar tela", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Ver conclusão da investigação", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Conclusão da equipe" }),
  ).toBeVisible();
});

test("restarts only once and restores the standard base", async ({ page }) => {
  await page.goto("/#data");
  await page
    .getByRole("button", { name: "Reiniciar minha demonstração", exact: true })
    .click();
  let posts = 0;
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Confirmar reinício", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reiniciando…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("status").filter({
      hasText: "Demonstração reiniciada com a base padrão de 30/09/2026.",
    }),
  ).toBeVisible();
  expect(posts).toBe(1);
  const workspace = await (await page.request.get("/api/workspace")).json();
  expect(workspace.tasks).toEqual([]);
  expect(workspace.summary.totalCount).toBe(25);
});

test("advances the daily suggestion after closure and restores progress after reopening without AI", async ({
  page,
}, info) => {
  expect(
    (await page.request.get("/api/browser-fixture?plan=1")).ok(),
  ).toBeTruthy();
  let modelRequests = 0;
  page.on("request", (request) => {
    if (
      request.url().includes("/api/investigations") &&
      request.method() === "POST"
    )
      modelRequests++;
  });
  await page.goto("/#overview");
  await expect(page.locator(".portfolio-summary")).toBeVisible();
  const portfolio = await page.locator(".portfolio-summary").boundingBox();
  const command = await page.locator(".agent-command").boundingBox();
  expect(portfolio!.y).toBeLessThan(command!.y);
  const stream = page.locator(".workstream-card").filter({
    has: page.getByRole("heading", { name: "Atendimento", exact: true }),
  });
  await stream
    .getByRole("button", {
      name: "Abrir pedido sugerido UI-A de Atendimento",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Ação realizada", exact: true })
    .fill("Cadastro sintético conferido e correção registrada pela equipe.");
  await page
    .getByRole("textbox", {
      name: "Evidência ou referência da execução",
      exact: true,
    })
    .fill("Protocolo sintético de confirmação cadastral.");
  await page
    .getByRole("combobox", {
      name: "A ação realizada resolveu a pendência deste pedido?",
      exact: true,
    })
    .selectOption("yes");
  await page
    .getByRole("combobox", {
      name: "Qual resultado foi confirmado?",
      exact: true,
    })
    .selectOption("endereco_corrigido");
  await page
    .getByRole("checkbox", {
      name: "A evidência da execução também comprova este resultado",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", {
      name: "Registrar execução e encerrar pedido",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Registro salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Registrar execução e encerrar pedido",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .click();
  await expect(stream.locator(".workstream-progress")).toHaveText(
    "Encerrados: 1 · Em aberto: 1",
  );
  await expect(
    stream.getByRole("button", {
      name: "Abrir pedido sugerido UI-NEXT de Atendimento",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    stream.getByText("Por que começar por este pedido", { exact: true }),
  ).toHaveCount(0);
  await expect(
    stream.getByText("Próximo pedido pela prioridade do plano.", {
      exact: true,
    }),
  ).toBeVisible();
  const suggestedContext = stream.getByRole("region", {
    name: "Resumo do pedido UI-NEXT",
    exact: true,
  });
  await expect(suggestedContext).toContainText("Endereço divergente");
  await expect(suggestedContext).toContainText(
    "Marca sintética · Produto de teste",
  );
  await expect(suggestedContext).toContainText("Aberta");
  await expect(suggestedContext).toContainText("dias úteis desde a abertura");
  await expect(suggestedContext).toContainText("Prazo prometido: 08/09/2026");
  await page.screenshot({
    path: info.outputPath("daily-progress.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    stream.getByRole("button", {
      name: "Abrir pedido sugerido UI-NEXT de Atendimento",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/#impact");
  const capacity = page.locator(".capacity-summary");
  await expect(capacity).toContainText("150 tratativas");
  await expect(capacity.locator("dd")).toHaveText([
    "150 tratativas",
    "1",
    "149",
  ]);
  await page.screenshot({
    path: info.outputPath("results-capacity.png"),
    fullPage: true,
  });
  await page.goto("/#queue");
  const orderNote = page.locator(".queue-order-note");
  await expect(orderNote).toBeVisible();
  const noteBounds = await orderNote.boundingBox();
  const labelBounds = await page.locator(".order-search > label").boundingBox();
  const panelBounds = await page.locator(".queue-panel").boundingBox();
  expect(noteBounds!.x - panelBounds!.x).toBeGreaterThan(8);
  expect(Math.abs(noteBounds!.x - labelBounds!.x)).toBeLessThan(1);
  await page.screenshot({ path: info.outputPath("queue-spacing.png") });
  await page
    .getByRole("checkbox", { name: "Consultar toda a carteira", exact: true })
    .check();
  await page.getByLabel("Buscar pedidos", { exact: true }).fill("UI-A");
  await page
    .getByRole("button", {
      name: "Abrir pedido UI-A de Marca sintética",
      exact: true,
    })
    .click();
  const reason = page.getByRole("textbox", {
    name: "Motivo da reabertura",
    exact: true,
  });
  await reason.fill(
    "O cadastro precisa de nova conferência nesta etapa sintética.",
  );
  await page
    .getByRole("button", { name: "Reabrir com justificativa", exact: true })
    .click();
  await expect(reason).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .click();
  await page.goto("/#overview");
  await expect(stream.locator(".workstream-progress")).toHaveText(
    "Encerrados: 0 · Em aberto: 2",
  );
  await expect(
    stream.getByRole("button", {
      name: "Abrir pedido sugerido UI-A de Atendimento",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    stream.getByRole("region", {
      name: "Resumo do pedido UI-NEXT",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(modelRequests).toBe(0);
});

test("explains plan capacity and recurrence reanalysis with readable dialogs", async ({
  page,
}, info) => {
  await page.goto("/#overview");
  await page
    .getByRole("button", { name: "Preparar meu dia com IA", exact: true })
    .click();
  await expect(page.locator(".plan-capacity-note")).toContainText(
    "150 vagas de referência",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.goto("/#insights");
  await page
    .getByRole("button", {
      name: "Analisar a base novamente com IA",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Analisar recorrências novamente?",
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    dialog.getByText("O que fica preservado", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("O que pode ser gerado", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Analisar novamente", exact: true }),
  ).toBeVisible();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: info.outputPath("recurrence-confirmation.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
