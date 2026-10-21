export type FormControl =
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Match the server's trimmed text constraints and explain native constraints in Portuguese. */
export function fieldValidationMessage(field: FormControl): string {
  if (field.matches(":disabled")) return "";
  const checkbox =
    field instanceof HTMLInputElement && field.type === "checkbox";
  if (field.required && (checkbox ? !field.checked : !field.value.trim()))
    return checkbox
      ? "Confirme esta opção para continuar."
      : field instanceof HTMLSelectElement
        ? "Selecione uma opção."
        : "Preencha este campo.";
  if (field instanceof HTMLInputElement && field.type === "file") return "";
  const value = field.value.trim();
  if (!(field instanceof HTMLSelectElement)) {
    if (value && field.minLength > 0 && value.length < field.minLength)
      return `Use pelo menos ${field.minLength} caracteres. Você informou ${value.length}.`;
    if (field.maxLength > 0 && value.length > field.maxLength)
      return `Use no máximo ${field.maxLength} caracteres.`;
  }
  if (field.validity.typeMismatch)
    return "Informe um valor no formato solicitado.";
  if (field.validity.badInput) return "Informe um número válido.";
  if (field.validity.rangeUnderflow || field.validity.rangeOverflow)
    return "Informe um valor dentro do limite indicado.";
  if (field.validity.patternMismatch || field.validity.stepMismatch)
    return "Confira o formato e o valor informado.";
  return "";
}
