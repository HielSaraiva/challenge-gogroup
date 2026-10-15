export type DataIssue = {
  code: "STATUS_CONFLICT" | "PROMISE_MISMATCH";
  detail: string;
};
export type Customer = {
  id: string;
  orders: number;
  revenue: string;
  firstOrder: string;
  contacts: number;
};
export type Carrier = {
  name: string;
  state: string;
  sla: number;
  freight: string;
};
export type Order = {
  id: string;
  customerId: string;
  brand: string;
  orderedAt: string;
  value: string;
  sku: string;
  product: string;
  quantity: number;
  gift: boolean;
  exception: string;
  sourceStatuses: string[];
  status: string;
  carrier: string;
  state: string;
  city: string;
  promisedAt: string;
  deliveredAt: string | null;
  machine: string;
  shift: string;
  dc: string;
  lot: string;
  openedAt: string;
  issues: DataIssue[];
  statusReview?: { status: string; note: string; reviewedAt: string };
  resolution?: { note: string; resolvedAt: string };
  caseHistory?: CaseEvent[];
};
export type CaseEvent = {
  id: string;
  action: "review_status" | "resolve" | "reopen";
  note: string;
  at: string;
  status?: string;
};
export type CaseRecord = {
  orderId: string;
  version: number;
  statusReview?: Order["statusReview"];
  resolution?: Order["resolution"];
  history: CaseEvent[];
};
export type Dataset = {
  orders: Order[];
  customers: Customer[];
  carriers: Carrier[];
  importedAt: string;
  sourceRows: number;
};
export type Weights = { value: number; urgency: number; relationship: number };
export type PriorityBreakdown = {
  value: number;
  urgency: number;
  relationship: number;
  score: number;
  delay: number;
  age: number;
  futureValue: string;
  cancellationRisk: string;
  cancellationProbability: number;
  resendCost: string;
  contractPromise: string;
  reasons: string[];
};
export type RankedOrder = Order & {
  priority: PriorityBreakdown;
  customer?: Customer;
};
export type Insight = {
  id: string;
  title: string;
  exception: string;
  dimension: string;
  group: string;
  count: number;
  total: number;
  share: number;
  evidenceIds: string[];
  hypothesis: string;
};
export const TASK_KINDS = [
  "revisao_cadastral",
  "investigacao_logistica",
  "revisao_separacao",
  "inspecao_lote",
  "manutencao_personalizacao",
  "revisao_status",
  "revisao_pagamento",
  "revisao_estoque",
  "proposta_reenvio",
  "proposta_reembolso",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export type Task = {
  id: string;
  investigationId: string;
  orderId: string;
  kind: TaskKind;
  title: string;
  justification: string;
  evidenceIds: string[];
  area: string;
  dueAt: string;
  status:
    "aberta" | "concluida" | "pendente_aprovacao" | "aprovada" | "rejeitada";
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string;
  facts?: string[];
};
export type ActionProposal = Task & {
  kind: "proposta_reenvio" | "proposta_reembolso";
};
export type ToolEvent = {
  tool: string;
  state: "running" | "ok" | "error";
  message: string;
  at: string;
};
export type Investigation = {
  id: string;
  target: string;
  type: "order" | "pattern";
  status: "running" | "completed" | "failed";
  summary: string;
  events: ToolEvent[];
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
};
export type SessionState = {
  tasks: Task[];
  investigations: Investigation[];
  expiresAt: string;
  cases?: Record<string, CaseRecord>;
};
export const REFERENCE_DATE = "2026-09-30";
export const DEFAULT_WEIGHTS: Weights = {
  value: 45,
  urgency: 35,
  relationship: 20,
};
export const CAPACITY = 150;
export const exceptionLabels: Record<string, string> = {
  atraso_entrega: "Atraso na entrega",
  extravio: "Extravio",
  rastreio_parado: "Rastreio parado",
  devolvido_transportadora: "Devolvido pela transportadora",
  avaria_transporte: "Avaria no transporte",
  vazamento_produto: "Vazamento de produto",
  item_faltante: "Item faltante",
  falha_personalizacao: "Falha de personalização",
  pagamento_pendente: "Pagamento pendente",
  ruptura_pos_venda: "Ruptura pós-venda",
  endereco_divergente: "Endereço divergente",
};
