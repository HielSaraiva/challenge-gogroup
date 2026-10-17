import { describe, expect, it } from "vitest";
import { parseCurrencyInput, formatCurrencyInput } from "@/lib/currency-input";

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
