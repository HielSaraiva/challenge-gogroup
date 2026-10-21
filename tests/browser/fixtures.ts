import type { Dataset, Task, Order, DailyPlan } from "../../src/domain/types";
import { DEFAULT_WEIGHTS, REFERENCE_DATE } from "../../src/domain/types";
import { queue } from "../../src/domain/analytics";
import { workstreams } from "../../src/domain/operations";
import { datasetReference, POLICY_VERSION } from "../../src/domain/planning";
const base: Order = {
  id: "UI-A",
  customerId: "UI-CUSTOMER",
  brand: "Marca sintética",
  orderedAt: "2026-09-01",
  value: "100.00",
  sku: "UI-SKU",
  product: "Produto de teste",
  quantity: 1,
  gift: false,
  exception: "endereco_divergente",
  sourceStatuses: ["aberta"],
  status: "aberta",
  carrier: "Transporte sintético",
  state: "SP",
  city: "Cidade de teste",
  promisedAt: "2026-09-08",
  deliveredAt: null,
  machine: "",
  shift: "noite",
  dc: "CD1",
  lot: "UI-LOT",
  openedAt: "2026-09-09",
  issues: [],
};
export const data: Dataset = {
  orders: [
    base,
    ...Array.from({ length: 24 }, (_, i) => ({
      ...base,
      id: `UI-${i}`,
      exception: i < 12 ? "item_faltante" : "atraso_entrega",
      shift: i < 12 ? "noite" : "manhã",
    })),
  ],
  customers: [
    {
      id: base.customerId,
      orders: 2,
      revenue: "200.00",
      firstOrder: "2025-01-01",
      contacts: 1,
    },
  ],
  carriers: [{ name: base.carrier, state: "SP", sla: 3, freight: "12.00" }],
  importedAt: "2026-09-30T12:00:00.000Z",
  sourceRows: 25,
};
const task: Task = {
  id: "11111111-1111-4111-8111-111111111111",
  investigationId: "22222222-2222-4222-8222-222222222222",
  orderId: "UI-A",
  kind: "revisao_cadastral",
  title: "Conferir endereço do pedido sintético",
  justification: "Conferir a divergência com os registros da operação.",
  evidenceIds: ["UI-A"],
  area: "Atendimento",
  dueAt: "2026-10-01",
  status: "aberta",
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  idempotencyKey: "browser-order",
};
export const tasks: Task[] = [
  task,
  {
    ...task,
    id: "33333333-3333-4333-8333-333333333333",
    scope: "process",
    kind: "melhoria_processo",
    insightId: "item_faltante:shift:noite",
    orderId: "UI-0",
    title: "Conferir a separação no turno da noite",
    justification:
      "A concentração pode estar relacionada à conferência dos itens; a hipótese precisa ser validada pela equipe.",
    nextStep:
      "Compare os romaneios e a conferência dos itens com outros turnos antes de concluir a causa.",
    area: "Operações / CD",
    affectedOrderIds: Array.from({ length: 12 }, (_, i) => `UI-${i}`),
    evidenceIds: ["UI-0", "UI-1", "UI-2"],
    idempotencyKey: "browser-process",
  },
];

export const planData: Dataset = {
  ...data,
  sourceRows: 26,
  orders: [...data.orders, { ...base, id: "UI-NEXT" }],
};
const selection = queue(planData);
export const dailyPlan: DailyPlan = {
  id: "55555555-5555-4555-8555-555555555555",
  investigationId: "66666666-6666-4666-8666-666666666666",
  idempotencyKey: "browser-daily-plan",
  fingerprint: "browser-daily-plan",
  createdAt: "2026-10-20T12:00:00.000Z",
  reference: REFERENCE_DATE,
  policyVersion: POLICY_VERSION,
  datasetReference: datasetReference(planData),
  statusSnapshot: Object.fromEntries(
    selection.orders.map((o) => [o.id, o.status]),
  ),
  strategy: "equilibrada",
  strategyReason:
    "Equilibrar espera, exposição e relacionamento com os clientes.",
  briefing: "Conferir as evidências e encaminhar os casos por área.",
  selectedOrderIds: selection.orders.map((o) => o.id),
  capacity: selection.capacity,
  usedCapacity: 0,
  weights: DEFAULT_WEIGHTS,
  priorityAreas: ["Atendimento"],
  comparison: { prioritized: selection.prioritized, fifo: selection.fifo },
  workstreams: workstreams(planData).map((stream) => ({
    area: stream.area,
    orderIds: stream.orderIds,
    value: stream.value,
    risk: stream.risk,
    nextStep: "Conferir as referências do caso e registrar o encaminhamento.",
    agentDecision: {
      firstOrderId: stream.area === "Atendimento" ? "UI-A" : stream.orderIds[0],
      justification:
        "O caso representa uma divergência que precisa ser conferida pela equipe.",
    },
  })),
};

// Additional native-select states, used only by the disposable browser app.
export const selectData: Dataset = {
  ...data,
  sourceRows: data.sourceRows + 2,
  orders: [
    ...data.orders,
    {
      ...base,
      id: "UI-CONFLICT",
      status: "status_divergente",
      sourceStatuses: ["aberta", "em_analise"],
    },
    { ...base, id: "UI-RESEND", exception: "item_faltante" },
  ],
};
export const selectTasks: Task[] = [
  ...tasks,
  {
    ...task,
    id: "77777777-7777-4777-8777-777777777777",
    orderId: "UI-CONFLICT",
    kind: "revisao_status",
    evidenceIds: ["UI-CONFLICT"],
    idempotencyKey: "browser-conflict",
  },
  {
    ...task,
    id: "88888888-8888-4888-8888-888888888888",
    orderId: "UI-RESEND",
    kind: "proposta_reenvio",
    status: "aprovada",
    approval: { at: task.createdAt },
    evidenceIds: ["UI-RESEND"],
    idempotencyKey: "browser-resend",
  },
];
