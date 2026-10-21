import { expect, test, type Page } from "@playwright/test";
import type { WorkspaceSnapshot } from "../../src/domain/workspace";

test.beforeEach(async ({ page }) => {
  expect(
    (await page.request.get("/api/browser-fixture?selects=1")).ok(),
  ).toBeTruthy();
});
async function workspace(page: Page): Promise<WorkspaceSnapshot> {
  const response = await page.request.get("/api/workspace");
  expect(response.ok()).toBeTruthy();
  return response.json();
}
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
async function execution(page: Page) {
  await page
    .getByRole("textbox", { name: "Ação realizada", exact: true })
    .fill("Tratativa executada no ambiente sintético para verificar o fluxo.");
  await page
    .getByRole("textbox", {
      name: "Evidência ou referência da execução",
      exact: true,
    })
    .fill("Referência sintética de execução TESTE-REGRESSAO.");
}

test("reviews a conflicting status without closing the case", async ({
  page,
}) => {
  await openOrder(page, "UI-CONFLICT");
  await page
    .getByRole("combobox", { name: "Status confirmado", exact: true })
    .selectOption("em_analise");
  await page
    .getByRole("textbox", { name: "Como o status foi validado?", exact: true })
    .fill(
      "Status conferido na fonte sintética; referência de validação TESTE-STATUS.",
    );
  await page
    .getByRole("button", { name: "Confirmar status", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await workspace(page)).orders.find(
          (order) => order.id === "UI-CONFLICT",
        )?.status,
    )
    .toBe("em_analise");
  const snapshot = await workspace(page);
  expect(
    snapshot.tasks.find((task) => task.orderId === "UI-CONFLICT")?.status,
  ).toBe("concluida");
  expect(
    snapshot.orders.find((order) => order.id === "UI-CONFLICT")?.resolution,
  ).toBeUndefined();
  await expect(
    page.getByRole("button", {
      name: "Investigar este pedido com IA",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await openOrder(page, "UI-CONFLICT");
  await expect(
    page.getByRole("heading", {
      name: "Registre o resultado da tratativa",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Status confirmado", exact: true }),
  ).toHaveCount(0);
});

test("keeps a dispatched resend open and closes only with receipt evidence", async ({
  page,
}) => {
  await openOrder(page, "UI-RESEND");
  await page
    .getByRole("combobox", {
      name: "Em que etapa está o reenvio?",
      exact: true,
    })
    .selectOption("dispatched");
  await execution(page);
  await expect(
    page.getByRole("combobox", {
      name: "A ação realizada resolveu a pendência deste pedido?",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Registrar despacho e aguardar recebimento",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await workspace(page)).tasks.find(
          (task) => task.orderId === "UI-RESEND",
        )?.execution?.stage,
    )
    .toBe("dispatched");
  expect(
    (await workspace(page)).orders.find((order) => order.id === "UI-RESEND")
      ?.resolution,
  ).toBeUndefined();
  await page
    .getByRole("combobox", {
      name: "Qual resultado foi confirmado?",
      exact: true,
    })
    .selectOption("item_reenviado");
  await expect(
    page.getByRole("checkbox", {
      name: "A evidência da execução também comprova este resultado",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: "Confirmei o recebimento do item reenviado e que a pendência foi resolvida.",
      exact: true,
    })
    .check();
  await page
    .getByRole("textbox", {
      name: "Evidência complementar do resultado",
      exact: true,
    })
    .fill(
      "Recebimento do item confirmado no comprovante sintético TESTE-RECEBIMENTO.",
    );
  await page
    .getByRole("button", {
      name: "Confirmar resultado e encerrar",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Reabrir com justificativa",
      exact: true,
    }),
  ).toBeVisible();
  const outcome = (await workspace(page)).orders.find(
    (order) => order.id === "UI-RESEND",
  )?.resolution?.outcome;
  expect(outcome).toMatchObject({
    type: "item_reenviado",
    receiptConfirmed: true,
    executionTaskId: "88888888-8888-4888-8888-888888888888",
  });
  expect(outcome?.cost).toBeUndefined();
});

test("approves a refund, requires the cost classification and persists the combined closure", async ({
  page,
}) => {
  await openOrder(page, "UI-REFUND");
  await expect(
    page.getByRole("textbox", { name: "Ação realizada", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Aprovar proposta de reembolso", exact: true })
    .click();
  await execution(page);
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
    .selectOption("reembolso_registrado");
  await page
    .getByRole("checkbox", {
      name: "A evidência da execução também comprova este resultado",
      exact: true,
    })
    .check();
  await page
    .getByRole("textbox", { name: /^Reembolso registrado \(R\$\)/ })
    .fill("25,00");
  await page
    .getByRole("textbox", {
      name: "Custo adicional para resolver o problema (R$) — opcional",
      exact: true,
    })
    .fill("2,50");
  const costKind = page.getByRole("combobox", {
    name: "Como o custo foi apurado?",
    exact: true,
  });
  await expect(costKind).toHaveValue("");
  await page
    .getByRole("button", {
      name: "Registrar execução e encerrar pedido",
      exact: true,
    })
    .click();
  expect(
    (await workspace(page)).orders.find((order) => order.id === "UI-REFUND")
      ?.resolution,
  ).toBeUndefined();
  await costKind.selectOption("declared");
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
  const snapshot = await workspace(page);
  const outcome = snapshot.orders.find((order) => order.id === "UI-REFUND")
    ?.resolution?.outcome;
  expect(outcome).toMatchObject({
    type: "reembolso_registrado",
    refund: "25.00",
    cost: { amount: "2.50", kind: "declared" },
    executionTaskId: "99999999-9999-4999-8999-999999999999",
  });
  expect(
    snapshot.tasks.find((task) => task.orderId === "UI-REFUND")?.status,
  ).toBe("concluida");
  await page.reload();
  await openOrder(page, "UI-REFUND");
  await expect(
    page.getByRole("button", {
      name: "Reabrir com justificativa",
      exact: true,
    }),
  ).toBeVisible();
});

test("rejects a proposal without recording an execution or result", async ({
  page,
}) => {
  await openOrder(page, "UI-REFUND");
  await page
    .getByRole("button", { name: "Rejeitar proposta", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Por que esta proposta foi rejeitada?",
      exact: true,
    })
    .fill(
      "A referência sintética exige conferência adicional antes do reembolso.",
    );
  await page
    .getByRole("button", { name: "Confirmar rejeição", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await workspace(page)).tasks.find(
          (task) => task.orderId === "UI-REFUND",
        )?.status,
    )
    .toBe("rejeitada");
  const snapshot = await workspace(page);
  expect(
    snapshot.tasks.find((task) => task.orderId === "UI-REFUND")?.execution,
  ).toBeUndefined();
  expect(
    snapshot.orders.find((order) => order.id === "UI-REFUND")?.resolution,
  ).toBeUndefined();
  await expect(
    page.getByText("Proposta rejeitada — pedido permanece aberto", {
      exact: true,
    }),
  ).toBeVisible();
});
