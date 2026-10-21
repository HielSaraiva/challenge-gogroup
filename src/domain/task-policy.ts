import type { Task } from "./types";

export const taskAreas: Record<Task["kind"], string> = {
  melhoria_processo: "Excelência operacional",
  revisao_cadastral: "Atendimento",
  investigacao_logistica: "Logística",
  revisao_separacao: "Operações / CD",
  inspecao_lote: "Qualidade",
  manutencao_personalizacao: "Produção",
  revisao_status: "Operações",
  revisao_pagamento: "Financeiro",
  revisao_estoque: "Estoque",
  proposta_reenvio: "Operações",
  proposta_reembolso: "Financeiro",
};
export const allowedTaskKinds: Record<string, Task["kind"][]> = {
  atraso_entrega: [
    "investigacao_logistica",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
  extravio: [
    "investigacao_logistica",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
  rastreio_parado: [
    "investigacao_logistica",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
  devolvido_transportadora: [
    "investigacao_logistica",
    "revisao_cadastral",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
  avaria_transporte: [
    "investigacao_logistica",
    "inspecao_lote",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
  vazamento_produto: [
    "inspecao_lote",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
  item_faltante: [
    "revisao_separacao",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
  falha_personalizacao: [
    "manutencao_personalizacao",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
  endereco_divergente: ["revisao_cadastral"],
  pagamento_pendente: ["revisao_pagamento", "proposta_reembolso"],
  ruptura_pos_venda: [
    "revisao_estoque",
    "proposta_reenvio",
    "proposta_reembolso",
  ],
};
