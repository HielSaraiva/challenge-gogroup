import { test, expect, type Page, type TestInfo } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

const tabs = [
  ["overview", "Prepare seu dia com o agente"],
  ["queue", "Pedidos para acompanhar"],
  ["agent", "Pendências da equipe"],
  ["impact", "Resultados da operação"],
  ["insights", "Recorrências para investigar"],
  ["data", "Dados da operação"],
  ["method", "Metodologia da operação"],
] as const;
async function capture(
  page: Page,
  info: TestInfo,
  name: string,
  dialog = false,
) {
  const root = dialog ? page.getByRole("dialog") : page.locator("main");
  const metrics = await root.evaluate((element) => {
    const styles = (selector: string) =>
      Array.from(element.querySelectorAll<HTMLElement>(selector))
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => {
          const s = getComputedStyle(el),
            box = el.getBoundingClientRect();
          return {
            text: el.innerText?.slice(0, 90),
            class: el.className,
            font: s.fontFamily,
            size: s.fontSize,
            weight: s.fontWeight,
            color: s.color,
            background: s.backgroundColor,
            border: s.borderRadius,
            padding: s.padding,
            width: box.width,
            height: box.height,
          };
        });
    return {
      headings: styles("h1,h2,h3"),
      buttons: styles("button"),
      panels: styles(".panel"),
      fields: styles(
        "input:not([type=checkbox]):not([type=radio]),select,textarea",
      ),
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    };
  });
  expect
    .soft(metrics.pageWidth, `${name}: horizontal page overflow`)
    .toBeLessThanOrEqual(metrics.viewportWidth + 1);
  for (const field of await root.locator("input[type=file]").all()) {
    expect(
      await field.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const container = el.closest("fieldset")!.getBoundingClientRect();
        return box.left >= container.left && box.right <= container.right + 1;
      }),
      `${name}: file selector stays inside its form`,
    ).toBeTruthy();
  }
  if (dialog) {
    expect(
      await root.evaluate((el) => {
        const title = el.querySelector("h2");
        const close = el.querySelector(".dialog-close");
        if (!title || !close) return true;
        const range = document.createRange();
        range.selectNodeContents(title);
        const button = close.getBoundingClientRect();
        return Array.from(range.getClientRects()).every(
          (text) =>
            text.right <= button.left ||
            text.left >= button.right ||
            text.bottom <= button.top ||
            text.top >= button.bottom,
        );
      }),
      `${name}: title does not overlap the close button`,
    ).toBeTruthy();
    expect
      .soft(
        await root.evaluate((el) => el.scrollWidth <= el.clientWidth),
        `${name}: dialog overflow`,
      )
      .toBeTruthy();
  }
  await info.attach(`${name}-styles`, {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: !dialog,
    animations: "disabled",
  });
}
async function visit(page: Page, hash: string, title: string) {
  await page.goto(`/#${hash}`);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Conferindo a operação…", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("audits all seven pages before and after an active plan", async ({
  page,
}, info) => {
  for (const [hash, title] of tabs) {
    await visit(page, hash, title);
    if (hash === "data")
      await expect(page.locator(".data-status")).toBeVisible();
    await capture(page, info, `initial-${hash}`);
  }
  expect(
    (await page.request.get("/api/browser-fixture?plan=1")).ok(),
  ).toBeTruthy();
  await page.reload();
  for (const [hash, title] of tabs) {
    await visit(page, hash, title);
    if (hash === "overview")
      await expect(
        page.getByRole("heading", {
          name: "Seu plano de trabalho",
          exact: true,
        }),
      ).toBeVisible();
    await capture(page, info, `active-${hash}`);
  }
});

test("audits order forms, recurrence steps and confirmation dialogs", async ({
  page,
}, info) => {
  expect(
    (await page.request.get("/api/browser-fixture?plan=1")).ok(),
  ).toBeTruthy();
  await visit(page, "overview", tabs[0][1]);
  await page
    .getByRole("button", { name: "Preparar novo plano com IA", exact: true })
    .click();
  await capture(page, info, "modal-plan", true);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await visit(page, "queue", tabs[1][1]);
  await page.getByLabel("Buscar pedidos", { exact: true }).fill("UI-A");
  await page
    .getByRole("button", {
      name: "Abrir pedido UI-A de Marca sintética",
      exact: true,
    })
    .click();
  await capture(page, info, "modal-order", true);
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
  await capture(page, info, "modal-result", true);
  await page.keyboard.press("Escape");
  await capture(page, info, "modal-discard", true);
  await page
    .getByRole("button", { name: "Sair sem salvar alterações", exact: true })
    .click();
  await visit(page, "insights", tabs[4][1]);
  await page
    .getByRole("button", {
      name: "Analisar a base novamente com IA",
      exact: true,
    })
    .click();
  await capture(page, info, "modal-reanalysis", true);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Abrir investigação", exact: true })
    .click();
  for (const step of ["Orientação", "1. Pedidos", "2. Registro"]) {
    await page.getByRole("button", { name: step, exact: true }).click();
    await capture(page, info, `modal-recurrence-${step[0]}`, true);
  }
  await page.keyboard.press("Escape");
  await visit(page, "data", tabs[5][1]);
  await page
    .getByRole("button", { name: "Reiniciar minha demonstração", exact: true })
    .click();
  await capture(page, info, "modal-reset", true);
  await page.keyboard.press("Escape");
});
