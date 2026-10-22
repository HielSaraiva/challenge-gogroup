import { money } from "@/shared/formatting";

export function parseCurrencyInput(input: string): string {
  const value = input.replace(/R\$|\s/g, "");
  if (!value) return "";
  let normalized: string;
  if (/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(value))
    normalized = value.replaceAll(".", "").replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(value)) normalized = value;
  else throw new Error("Informe um valor válido em reais, como 125,50.");
  const [whole, cents = ""] = normalized.split(".");
  const integer = whole.replace(/^0+(?=\d)/, "");
  if (integer.length > 7) throw new Error("O valor máximo é R$ 9.999.999,99.");
  return `${integer}.${cents.padEnd(2, "0")}`;
}

export function formatCurrencyInput(input: string): string {
  try {
    const value = parseCurrencyInput(input);
    return value ? money(value) : "";
  } catch {
    return input;
  }
}

/** Explain invalid monetary drafts without turning unknown costs into zero. */
export function currencyValidationMessage(
  input: string,
  options: { positive?: boolean; max?: string } = {},
): string | undefined {
  if (!input.trim()) return;
  try {
    const amount = parseCurrencyInput(input);
    if (!amount) return "Informe um valor válido em reais, como 125,50.";
    if (options.positive && Number(amount) <= 0)
      return "Informe um reembolso maior que zero.";
    if (options.max !== undefined && Number(amount) > Number(options.max))
      return `O reembolso não pode ultrapassar ${money(options.max)}, o valor disponível neste pedido.`;
  } catch (error) {
    return (error as Error).message;
  }
}
