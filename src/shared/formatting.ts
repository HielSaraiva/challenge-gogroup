export function money(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}
export function shortDate(value: string) {
  return value.slice(0, 10).split("-").reverse().join("/");
}
export {
  statusLabel,
  taskFactLabel,
  generatedTextLabel,
  insightGroupLabel,
} from "@/domain/labels";
