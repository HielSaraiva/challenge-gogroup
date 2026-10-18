import type { Dataset, Task, Order } from "../../src/domain/types";
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
