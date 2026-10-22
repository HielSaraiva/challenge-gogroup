import { describe, expect, it } from "vitest";
import {
  parseCurrencyInput,
  formatCurrencyInput,
  currencyValidationMessage,
} from "../../src/shared/currency-input";

describe("valores monetários da tratativa", () => {
  it("normaliza reais e centavos brasileiros sem perder precisão", () => {
    expect(parseCurrencyInput("R$ 1.234,56")).toBe("1234.56");
    expect(parseCurrencyInput("25,5")).toBe("25.50");
    expect(parseCurrencyInput("25.50")).toBe("25.50");
    expect(parseCurrencyInput("100")).toBe("100.00");
  });
  it("distingue valor não informado de zero", () => {
    expect(parseCurrencyInput("")).toBe("");
    expect(formatCurrencyInput("")).toBe("");
    expect(parseCurrencyInput("0,00")).toBe("0.00");
  });
  it("formata em reais e rejeita negativos, precisão inválida e valores excessivos", () => {
    expect(formatCurrencyInput("1234,56").replace(/\s/g, " ")).toBe(
      "R$ 1.234,56",
    );
    expect(() => parseCurrencyInput("-10")).toThrow();
    expect(() => parseCurrencyInput("10,123")).toThrow();
    expect(() => parseCurrencyInput("10000000")).toThrow();
  });
});

describe("mensagens dos valores preenchidos", () => {
  it("permite custo desconhecido ou zero e explica formatos inválidos", () => {
    expect(currencyValidationMessage("")).toBeUndefined();
    expect(currencyValidationMessage("0,00")).toBeUndefined();
    for (const input of ["-10", "abc", "12,345", "R$"])
      expect(currencyValidationMessage(input)).toMatch(/valor válido/);
  });
  it("explica reembolso zero, limite restante e valor máximo", () => {
    expect(currencyValidationMessage("0", { positive: true })).toMatch(
      /maior que zero/,
    );
    expect(
      currencyValidationMessage("25,01", { positive: true, max: "25.00" }),
    ).toMatch(/valor disponível neste pedido/);
    expect(
      currencyValidationMessage("25,00", { positive: true, max: "25.00" }),
    ).toBeUndefined();
    expect(currencyValidationMessage("10000000")).toMatch(/valor máximo/);
  });
});
