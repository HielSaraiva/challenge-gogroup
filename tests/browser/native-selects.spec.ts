import {
  test,
  expect,
  type Page,
  type Locator,
  type TestInfo,
} from "@playwright/test";

async function inspectSelect(
  page: Page,
  field: Locator,
  value: string,
  name: string,
  info: TestInfo,
) {
  await field.scrollIntoViewIfNeeded();
  await expect(field).toBeEnabled();
  const metrics = await field.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    const transforms = [];
    for (let node = el.parentElement; node; node = node.parentElement)
      if (getComputedStyle(node).transform !== "none")
        transforms.push({
          class: node.className,
          transform: getComputedStyle(node).transform,
        });
    return {
      tag: el.tagName,
      fontSize: parseFloat(css.fontSize),
      x: rect.x,
      right: rect.right,
      height: rect.height,
      viewport: innerWidth,
      transforms,
    };
  });
  expect(metrics.tag).toBe("SELECT");
  expect(metrics.x).toBeGreaterThanOrEqual(0);
  expect(metrics.right).toBeLessThanOrEqual(metrics.viewport + 1);
  expect(metrics.height).toBeGreaterThanOrEqual(44);
  expect(metrics.fontSize).toBeGreaterThanOrEqual(16);
  await field.click();
  const nativePopupOpen = await field.evaluate((el) => el.matches(":open"));
  await info.attach(`${name}-native-control`, {
    body: JSON.stringify({ ...metrics, nativePopupOpen }, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({ path: info.outputPath(`${name}-open.png`) });
  if (nativePopupOpen) await page.keyboard.press("Enter");
  await field.selectOption(value);
  await expect(field).toHaveValue(value);
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
async function discardOrder(page: Page) {
  await page
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .click();
  const discard = page.getByRole("button", {
    name: "Sair sem salvar alterações",
    exact: true,
  });
  await expect(discard).toBeVisible();
  await discard.click();
}

test("checks every native select in narrow desktop and touch emulation", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (await page.request.get("/api/browser-fixture?selects=1")).ok(),
  ).toBeTruthy();
  await page.goto("/#queue");
  await inspectSelect(
    page,
    page.getByRole("combobox", { name: "Pendência", exact: true }),
    "endereco_divergente",
    "order-exception",
    info,
  );
  await page
    .getByRole("combobox", { name: "Pendência", exact: true })
    .selectOption("");
  await inspectSelect(
    page,
    page.getByRole("combobox", { name: "Status", exact: true }),
    "aberta",
    "order-status",
    info,
  );
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("");
  await inspectSelect(
    page,
    page.getByRole("combobox", { name: "Itens por página", exact: true }),
    "25",
    "order-page-size",
    info,
  );
  await openOrder(page, "UI-A");
  await inspectSelect(
    page,
    page.getByRole("combobox", {
      name: "A ação realizada resolveu a pendência deste pedido?",
      exact: true,
    }),
    "yes",
    "execution-answer",
    info,
  );
  await inspectSelect(
    page,
    page.getByRole("combobox", {
      name: "Qual resultado foi confirmado?",
      exact: true,
    }),
    "endereco_corrigido",
    "resolution-type",
    info,
  );
  await page
    .getByRole("textbox", {
      name: "Custo adicional para resolver o problema (R$) — opcional",
      exact: true,
    })
    .fill("15");
  await inspectSelect(
    page,
    page.getByRole("combobox", {
      name: "Como o custo foi apurado?",
      exact: true,
    }),
    "declared",
    "resolution-cost-kind",
    info,
  );
  await discardOrder(page);
  await openOrder(page, "UI-CONFLICT");
  await inspectSelect(
    page,
    page.getByRole("combobox", {
      name: "Status confirmado",
      exact: true,
    }),
    "em_analise",
    "status-review",
    info,
  );
  await discardOrder(page);
  await openOrder(page, "UI-RESEND");
  await inspectSelect(
    page,
    page.getByRole("combobox", {
      name: "Em que etapa está o reenvio?",
      exact: true,
    }),
    "received",
    "resend-stage",
    info,
  );
  await discardOrder(page);
  await page.goto("/#agent");
  await inspectSelect(
    page,
    page.getByRole("combobox", { name: "Itens por página", exact: true }),
    "25",
    "pending-page-size",
    info,
  );
  await page.goto("/#insights");
  await inspectSelect(
    page,
    page.getByRole("combobox", { name: "Itens por página", exact: true }),
    "12",
    "recurrence-page-size",
    info,
  );
  await page
    .getByRole("button", { name: "Abrir investigação", exact: true })
    .click();
  await page.getByRole("button", { name: "2. Registro", exact: true }).click();
  await inspectSelect(
    page,
    page.getByRole("combobox", {
      name: "Resultado desta verificação",
      exact: true,
    }),
    "inconclusiva",
    "recurrence-outcome",
    info,
  );
});
