import { test, expect, type Page } from "@playwright/test";

const toggle = (page: Page) =>
  page.getByRole("button", { name: /^Navegar na metodologia/ });
const index = (page: Page) =>
  page.getByRole("navigation", { name: "Nesta metodologia", exact: true });
async function expectSection(page: Page, id: string, label: string) {
  await expect(
    page.locator(".method-index a[aria-current=location]"),
  ).toHaveAttribute("href", `#${id}`);
  if (page.viewportSize()!.width <= 900)
    await expect(toggle(page)).toContainText(label);
}
async function scrollToReadingSection(page: Page, id: string) {
  await page
    .locator(`#${id}`)
    .evaluate((el) =>
      el.scrollIntoView({ block: "start", behavior: "instant" }),
    );
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("follows reading position in both directions without rewriting history or stealing focus", async ({
  page,
}, info) => {
  await page.goto("/#method");
  await expect(
    page.getByRole("heading", { name: "Metodologia da operação", exact: true }),
  ).toBeVisible();
  await expectSection(page, "method-flow", "Do diagnóstico ao resultado");
  if (page.viewportSize()!.width <= 900) await toggle(page).click();
  await index(page)
    .getByRole("link", { name: "Execução e resultados", exact: true })
    .click();
  await expect(page).toHaveURL(/#method-outcomes$/);
  await expectSection(page, "method-outcomes", "Execução e resultados");
  const focusedTitle = page.getByRole("heading", {
    name: "Da execução ao encerramento",
    exact: true,
  });
  await expect(focusedTitle).toBeFocused();
  const beforeScrollUrl = page.url();
  for (const [id, label] of [
    ["method-data", "Dados e tecnologia"],
    ["method-agent", "Papel da IA"],
    ["method-priority", "Priorização"],
    ["method-pilot", "Limites e validação"],
  ]) {
    await scrollToReadingSection(page, id);
    await expectSection(page, id, label);
    await expect(focusedTitle).toBeFocused();
    expect(page.url()).toBe(beforeScrollUrl);
  }
  if (page.viewportSize()!.width <= 900) {
    await toggle(page).click();
    await expect(index(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(toggle(page)).toBeFocused();
    await toggle(page).click();
    await page.locator("#method-pilot h2").click();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  }
  await page.screenshot({
    path: info.outputPath("methodology-current-section.png"),
    animations: "disabled",
  });
});

test("keeps the mobile reading bar opaque and flush with the header at narrow widths", async ({
  page,
}, info) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#method-outcomes");
    await expectSection(page, "method-outcomes", "Execução e resultados");
    const bar = await page.locator(".method-sidebar").boundingBox();
    const header = await page.locator("header.sidebar").boundingBox();
    const title = await page.locator("#method-outcomes h2").boundingBox();
    expect(Math.abs(bar!.y - (header!.y + header!.height))).toBeLessThanOrEqual(
      1,
    );
    expect(bar!.x).toBeLessThanOrEqual(1);
    expect(bar!.x + bar!.width).toBeGreaterThanOrEqual(width - 1);
    expect(title!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height + 12);
    expect(
      await page
        .locator(".method-sidebar")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(255, 255, 255)");
    await page.screenshot({
      path: info.outputPath(`methodology-reading-bar-${width}.png`),
      animations: "disabled",
    });
  }
});
