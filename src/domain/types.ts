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
  resolution?: {
    note: string;
    resolvedAt: string;
    financial?: FinancialOutcome;
    outcome?: ResolutionOutcome;
  };
  caseHistory?: CaseEvent[];
};
export type CaseEvent = {
  id: string;
  action: "review_status" | "resolve" | "reopen";
  note: string;
  at: string;
  status?: string;
  financial?: FinancialOutcome;
  outcome?: ResolutionOutcome;
};
export type FinancialOutcome = {
  retained: string;
  refunded: string;
  cost: string;
  evidence: string;
  source: "operator_demo";
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
  selectionReason?: string;
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
  baselineShare: number;
  enrichment: number;
  scope: "case" | "process";
  investigationQuestion: string;
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
  "melhoria_processo",
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
  execution?: TaskExecution;
  rejection?: { note: string; at: string };
  approval?: { at: string };
  conclusion?: ProcessConclusion;
  processProgress?: {
    observations: string;
    nextStep: string;
    evidenceIds: string[];
    outcome?: ProcessConclusion["outcome"];
    at: string;
  };
  scope?: "case" | "process";
  insightId?: string;
  previousTaskId?: string;
  affectedOrderIds?: string[];
  nextStep?: string;
};
export type ResolutionOutcome = {
  type:
    | "endereco_corrigido"
    | "entrega_confirmada"
    | "item_reenviado"
    | "pagamento_regularizado"
    | "estoque_regularizado"
    | "reembolso_registrado";
  evidence: string;
  evidenceTaskId?: string;
  executionTaskId?: string;
  receiptConfirmed?: boolean;
  refund?: string;
  cost?: { amount: string; kind: "estimated" | "declared" };
};
export type TaskExecution = {
  note: string;
  evidence: string;
  at?: string;
  stage?: "dispatched" | "received";
};
export type ProcessConclusion = {
  outcome: "confirmada" | "descartada" | "inconclusiva";
  observations: string;
  evidenceIds: string[];
  nextStep: string;
  at?: string;
};
export type ActionProposal = Task & {
  kind: "proposta_reenvio" | "proposta_reembolso";
};
export type ToolEvent = {
  operationId?: string;
  tool: string;
  state: "running" | "ok" | "error";
  message: string;
  at: string;
};
export type Investigation = {
  id: string;
  target: string;
  type: "order" | "pattern" | "daily" | "recurrences";
  status: "running" | "completed" | "failed";
  summary: string;
  events: ToolEvent[];
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
  planId?: string;
  consultedInsightIds?: string[];
  recurrenceReview?: {
    reason: string;
    selectedInsightIds: string[];
    reusedTaskIds: string[];
  };
};
export type Workstream = {
  area: string;
  orderIds: string[];
  value: string;
  risk: string;
  nextStep: string;
  agentDecision?: { firstOrderId: string; justification: string };
};
export const STRATEGIES = {
  equilibrada: {
    label: "Equilibrada",
    weights: { value: 45, urgency: 35, relationship: 20 },
  },
  urgencia: {
    label: "Urgência",
    weights: { value: 25, urgency: 55, relationship: 20 },
  },
  relacionamento: {
    label: "Relacionamento",
    weights: { value: 25, urgency: 30, relationship: 45 },
  },
} as const;
export type Strategy = keyof typeof STRATEGIES;
export type DailyPlan = {
  policyVersion?: string;
  strategy?: Strategy;
  strategyReason?: string;
  datasetReference?: string;
  statusSnapshot?: Record<string, string>;
  comparison?: {
    prioritized: ReturnType<typeof import("./analytics").profile>;
    fifo: ReturnType<typeof import("./analytics").profile>;
  };

  id: string;
  idempotencyKey: string;
  investigationId: string;
  reference: string;
  createdAt: string;
  selectedOrderIds: string[];
  capacity: number;
  usedCapacity: number;
  weights: Weights;
  priorityAreas: string[];
  briefing: string;
  workstreams: Workstream[];
  fingerprint: string;
};
export type SessionState = {
  importedDataset?: Dataset;
  tasks: Task[];
  investigations: Investigation[];
  expiresAt: string;
  cases?: Record<string, CaseRecord>;
  plans?: DailyPlan[];
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
