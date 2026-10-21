import { expect, test, type Page, type Locator } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    (await page.request.get("/api/browser-fixture?selects=1")).ok(),
  ).toBeTruthy();
});
async function openOrder(page: Page, id: string) {
  await page.goto("/#queue");
  await page.getByLabel("Buscar pedidos", { exact: true }).fill(id);
  await page
    .getByRole("button", {
      name: `Abrir pedido ${id} de Marca sintética`,
      exact: true,
    })
    .click();
}
async function errorFor(field: Locator, message: RegExp) {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(message);
  await expect(field.locator("..").locator(".field-error")).toBeVisible();
}
const note =
  "Verificação realizada no ambiente sintético, conforme referência de atendimento.";
const evidence = "Protocolo sintético de verificação TESTE-VALIDACAO.";

test("shows required and trimmed text errors inline, links them and recovers without losing drafts", async ({
  page,
}, info) => {
  await openOrder(page, "UI-A");
  let writes = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/tasks") && request.method() === "PATCH")
      writes++;
  });
  const action = page.getByRole("textbox", {
    name: "Ação realizada",
    exact: true,
  });
  await page
    .getByRole("button", {
      name: "Registrar execução e manter aberto",
      exact: true,
    })
    .click();
  const summary = page.getByRole("alert", {
    name: "Campos para corrigir",
    exact: true,
  });
  await expect(summary).toBeFocused();
  await errorFor(action, /Preencha este campo/);
  await summary
    .getByRole("link", { name: "Ação realizada", exact: true })
    .click();
  await expect(action).toBeFocused();
  await action.fill("   abc   ");
  await errorFor(action, /pelo menos 15 caracteres.*informou 3/);
  await page.screenshot({ path: info.outputPath("inline-text-error.png") });
  await action.fill(note);
  await expect(action).not.toHaveAttribute("aria-invalid", "true");
  await page
    .getByRole("textbox", {
      name: "Evidência ou referência da execução",
      exact: true,
    })
    .fill(evidence);
  await page
    .getByRole("combobox", {
      name: "A ação realizada resolveu a pendência deste pedido?",
      exact: true,
    })
    .selectOption("no");
  expect(writes).toBe(0);
  await page
    .getByRole("button", {
      name: "Registrar execução e manter aberto",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Execução registrada", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
});

test("explains incompatible refund outcomes, invalid amounts and missing cost classification at their fields", async ({
  page,
}, info) => {
  await openOrder(page, "UI-REFUND");
  await page
    .getByRole("button", { name: "Aprovar proposta de reembolso", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Ação realizada", exact: true })
    .fill(note);
  await page
    .getByRole("textbox", {
      name: "Evidência ou referência da execução",
      exact: true,
    })
    .fill(evidence);
  await page
    .getByRole("combobox", {
      name: "A ação realizada resolveu a pendência deste pedido?",
      exact: true,
    })
    .selectOption("yes");
  const result = page.getByRole("combobox", {
    name: "Qual resultado foi confirmado?",
    exact: true,
  });
  await result.selectOption("pagamento_regularizado");
  await page
    .getByRole("checkbox", {
      name: "A evidência da execução também comprova este resultado",
      exact: true,
    })
    .check();
  const save = page.getByRole("button", {
    name: "Registrar execução e encerrar pedido",
    exact: true,
  });
  await save.click();
  await errorFor(result, /selecione Reembolso registrado/);
  await result.selectOption("reembolso_registrado");
  await page
    .getByRole("checkbox", {
      name: "A evidência da execução também comprova este resultado",
      exact: true,
    })
    .check();
  const refund = page.getByRole("textbox", {
    name: /^Reembolso registrado \(R\$\)/,
  });
  await refund.fill("0");
  await refund.blur();
  await errorFor(refund, /maior que zero/);
  await refund.fill("9999");
  await refund.blur();
  await errorFor(refund, /valor disponível neste pedido/);
  await refund.fill("25,00");
  const cost = page.getByRole("textbox", {
    name: "Custo adicional para resolver o problema (R$) — opcional",
    exact: true,
  });
  await cost.fill("abc");
  await cost.blur();
  await errorFor(cost, /valor válido em reais/);
  await cost.fill("0,00");
  await save.click();
  const classification = page.getByRole("combobox", {
    name: "Como o custo foi apurado?",
    exact: true,
  });
  await errorFor(classification, /Selecione uma opção/);
  await page.screenshot({ path: info.outputPath("inline-cost-error.png") });
  await classification.selectOption("declared");
  await save.click();
  await expect(
    page.getByRole("button", {
      name: "Reabrir com justificativa",
      exact: true,
    }),
  ).toBeVisible();
  const reason = page.getByRole("textbox", {
    name: "Motivo da reabertura",
    exact: true,
  });
  await reason.fill("   ");
  await page
    .getByRole("button", { name: "Reabrir com justificativa", exact: true })
    .click();
  await errorFor(reason, /Preencha este campo/);
});

test("shows status review errors next to the explanation", async ({ page }) => {
  await openOrder(page, "UI-CONFLICT");
  const explanation = page.getByRole("textbox", {
    name: "Como o status foi validado?",
    exact: true,
  });
  await explanation.fill("curto");
  await page
    .getByRole("button", { name: "Confirmar status", exact: true })
    .click();
  await errorFor(explanation, /pelo menos 10 caracteres/);
  await explanation.fill(note);
  await page
    .getByRole("button", { name: "Confirmar status", exact: true })
    .click();
  await expect(explanation).toHaveCount(0);
});

test("explains recurrence conclusion requirements while allowing partial progress", async ({
  page,
}) => {
  await page.goto("/#insights");
  await page
    .getByRole("button", { name: "Abrir investigação", exact: true })
    .click();
  await page.getByRole("button", { name: "2. Registro", exact: true }).click();
  const observations = page.getByRole("textbox", {
    name: "O que você verificou?",
    exact: true,
  });
  await observations.fill("abc");
  await page
    .getByRole("button", { name: "Salvar progresso", exact: true })
    .click();
  await expect(
    page.getByText(
      "Progresso salvo. A investigação continua aberta em Pendências.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar conclusão", exact: true })
    .click();
  await errorFor(observations, /pelo menos 20 caracteres/);
  await errorFor(
    page.getByRole("combobox", {
      name: "Resultado desta verificação",
      exact: true,
    }),
    /Selecione uma opção/,
  );
});

test("attaches file format, size and server row errors to the corresponding CSV field", async ({
  page,
}) => {
  await page.goto("/#data");
  expect(
    (
      await page.request.post("/api/session", {
        headers: { origin: new URL(page.url()).origin },
        data: {},
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  const orders = page.getByLabel("pedidos_excecao.csv", { exact: true });
  await expect(orders).toBeEnabled();
  await orders.setInputFiles({
    name: "arquivo.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("conteudo"),
  });
  await errorFor(orders, /formato CSV/);
  const customers = page.getByLabel("clientes.csv", { exact: true });
  const carriers = page.getByLabel("transportadoras.csv", { exact: true });
  await carriers.setInputFiles({
    name: "transportadoras.csv",
    mimeType: "text/csv",
    buffer: Buffer.alloc(100001),
  });
  await errorFor(carriers, /até 100 KB/);
  for (const [field, name] of [
    [orders, "pedidos_excecao.csv"],
    [customers, "clientes.csv"],
    [carriers, "transportadoras.csv"],
  ] as const)
    await field.setInputFiles({
      name,
      mimeType: "text/csv",
      buffer: Buffer.from("cabecalho\nvalor"),
    });
  await page.route("**/api/data", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 400,
        json: { error: "clientes.csv, linha 2: revise o campo n_pedidos." },
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Validar arquivos", exact: true })
    .click();
  await errorFor(customers, /linha 2.*n_pedidos/);
  await expect(orders).not.toHaveAttribute("aria-invalid", "true");
});

test("places a missing receipt confirmation error below the checkbox without overflow", async ({
  page,
}) => {
  await openOrder(page, "UI-RESEND");
  await page
    .getByRole("combobox", {
      name: "Em que etapa está o reenvio?",
      exact: true,
    })
    .selectOption("received");
  await page
    .getByRole("textbox", { name: "Ação realizada", exact: true })
    .fill(note);
  await page
    .getByRole("textbox", {
      name: "Evidência ou referência da execução",
      exact: true,
    })
    .fill(evidence);
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
    .selectOption("item_reenviado");
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
  const receipt = page.getByRole("checkbox", {
    name: "Confirmei o recebimento do item reenviado e que a pendência foi resolvida.",
    exact: true,
  });
  await errorFor(receipt, /Confirme esta opção/);
  const field = await receipt.boundingBox();
  const error = await receipt
    .locator("..")
    .locator(".field-error")
    .boundingBox();
  expect(error!.y).toBeGreaterThanOrEqual(field!.y + field!.height);
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBeTruthy();
  await receipt.check();
  await expect(receipt).not.toHaveAttribute("aria-invalid", "true");
  await page
    .getByRole("button", {
      name: "Registrar execução e encerrar pedido",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Reabrir com justificativa",
      exact: true,
    }),
  ).toBeVisible();
});
