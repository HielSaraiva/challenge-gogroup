import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function money(value: string | number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}
export function shortDate(value: string) {
  return value.slice(0, 10).split("-").reverse().join("/");
}
export function statusLabel(status: string) {
  return (
    (
      {
        aberta: "Aberta",
        em_analise: "Em análise",
        aguardando_transportadora: "Aguardando transportadora",
        aguardando_cliente: "Aguardando cliente",
        status_divergente: "Status divergente",
        resolvida: "Encerrada na sessão",
        concluida: "Concluída",
        pendente_aprovacao: "Aguardando aprovação",
        aprovada: "Aprovada",
        rejeitada: "Rejeitada",
      } as Record<string, string>
    )[status] || status.replaceAll("_", " ")
  );
}
