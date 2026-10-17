import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { exceptionLabels } from "@/domain/types";
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
        running: "Em andamento",
        completed: "Concluída",
        failed: "Não concluída",
      } as Record<string, string>
    )[status] || status.replaceAll("_", " ")
  );
}

// Older tasks persist their status as part of a human-readable fact string.
export function taskFactLabel(fact: string) {
  return generatedTextLabel(
    fact
      .replace(
        /\bgrupo (true|false)(?=[.,;\s]|$)/g,
        (_, group: string) => `grupo ${insightGroupLabel(group)}`,
      )
      .replace(
        /^(Status:\s*)([a-z_]+)(\.)?$/i,
        (_, prefix: string, status: string, punctuation: string = "") =>
          `${prefix}${statusLabel(status)}${punctuation}`,
      ),
  );
}

const generatedLabels: Record<string, string> = {
  ...exceptionLabels,
  ...Object.fromEntries(
    [
      "em_analise",
      "aguardando_transportadora",
      "aguardando_cliente",
      "status_divergente",
      "pendente_aprovacao",
    ].map((status) => [status, statusLabel(status)]),
  ),
  revisao_cadastral: "Revisão cadastral",
  investigacao_logistica: "Investigação logística",
  revisao_separacao: "Revisão de separação",
  inspecao_lote: "Inspeção do lote",
  manutencao_personalizacao: "Manutenção da personalização",
  revisao_status: "Conferência de status",
  revisao_pagamento: "Revisão de pagamento",
  revisao_estoque: "Revisão de estoque",
  proposta_reenvio: "Proposta de reenvio",
  proposta_reembolso: "Proposta de reembolso",
  melhoria_processo: "Investigação de recorrência",
  consultar_diagnostico: "Diagnóstico da carteira",
  comparar_estrategias: "Comparação de estratégias",
  registrar_plano_dia: "Registro do plano do dia",
  consultar_pedido: "Consulta do pedido",
  consultar_padroes: "Consulta de recorrências",
  simular_tratativa: "Simulação de tratativa",
  criar_tarefa: "Registro de tarefa",
  criar_acao_processo: "Registro de investigação",
  PROMISE_MISMATCH: "Divergência no prazo prometido",
};
const generatedIdentifier = new RegExp(
  `\\b(?:${Object.keys(generatedLabels).join("|")})\\b`,
  "g",
);
export function generatedTextLabel(text: string) {
  return text.replace(generatedIdentifier, (code) => generatedLabels[code]);
}
export function insightGroupLabel(group: string) {
  return group === "true"
    ? "Com brinde"
    : group === "false"
      ? "Sem brinde"
      : group.replaceAll("|", " / ");
}
