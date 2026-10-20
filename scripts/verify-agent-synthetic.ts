import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { rm } from "node:fs/promises";
import type { Dataset, Order } from "../src/domain/types";
import { investigate } from "../src/server/agent";
import { createSession, getSession } from "../src/server/store";
import { data as addressFixture } from "../tests/browser/fixtures";
import { recurrenceWorkload } from "../tests/fixtures/recurrences";
import { insights, queue } from "../src/domain/analytics";

// This integration check never reads the imported challenge dataset.
const parent = path.resolve(process.cwd(), ".local", "test-runs");
const directory = path.resolve(parent, `groq-${randomUUID()}`);
assert.ok(directory.startsWith(parent + path.sep));
Object.assign(process.env, {
  NODE_ENV: "test",
  OPERATIONS_TEST_DIRECTORY: directory,
  DATABASE_URL: "",
});
const order: Order = {
  id: "DEMO-LOGISTICS",
  customerId: "DEMO-CUSTOMER",
  brand: "Marca de teste",
  orderedAt: "2026-09-01",
  value: "100.00",
  sku: "DEMO-SKU",
  product: "Produto fictício",
  quantity: 1,
  gift: false,
  exception: "atraso_entrega",
  sourceStatuses: ["aberta"],
  status: "aberta",
  carrier: "Operador fictício",
  state: "SP",
  city: "Cidade fictícia",
  promisedAt: "2026-09-15",
  deliveredAt: null,
  machine: "",
  shift: "manhã",
  dc: "CD fictício",
  lot: "LOTE-TESTE",
  openedAt: "2026-09-16",
  issues: [],
};
const dataset: Dataset = {
  orders: [
    order,
    {
      ...order,
      id: "DEMO-PAYMENT",
      exception: "pagamento_pendente",
      value: "50.00",
    },
  ],
  customers: [
    {
      id: order.customerId,
      orders: 2,
      revenue: "150.00",
      firstOrder: "2026-09-01",
      contacts: 0,
    },
  ],
  carriers: [{ name: order.carrier, state: "SP", sla: 5, freight: "10.00" }],
  sourceRows: 2,
  importedAt: "2026-09-30T12:00:00Z",
};
function measured(
  label: string,
  run: import("../src/domain/types").Investigation,
) {
  assert.equal(run.status, "completed", run.summary);
  assert.equal(
    run.tokenUsage?.requests,
    1,
    `${label}: deve concluir na primeira resposta`,
  );
  console.log(label, run.tokenUsage);
}
async function verifyLarge(id: string) {
  const large = await investigate(
    { type: "recurrences", target: "base", requestId: randomUUID() },
    id,
    recurrenceWorkload,
    () => {},
  );
  measured("Recorrências: dezesseis candidatos em base sintética maior", large);
  assert.equal(large.consultedInsightIds?.length, 16);
  console.log(
    "Seleção da base sintética maior:",
    large.recurrenceReview?.reason,
    "Investigações:",
    large.taskIds.length,
  );
}
async function main() {
  assert.ok(
    process.env.GROQ_API_KEY,
    "Configure GROQ_API_KEY para o teste real com dados fictícios.",
  );
  const id = randomUUID();
  await createSession(id);
  if (process.argv.includes("--large-only")) return verifyLarge(id);
  if (process.argv.includes("--address-only")) {
    const result = await investigate(
      { type: "order", target: "UI-A", requestId: randomUUID() },
      id,
      addressFixture,
      () => {},
    );
    measured("Endereço sintético", result);
    return;
  }
  const run = await investigate(
    { type: "daily", target: "day", requestId: randomUUID() },
    id,
    dataset,
    () => {},
  );
  measured("Plano diário", run);
  const state = (await getSession(id))!;
  const plan = state.plans!.find((item) => item.id === run.planId)!;
  assert.ok(plan);
  assert.deepEqual(
    plan.selectedOrderIds,
    queue(dataset, plan.weights).orders.map((item) => item.id),
  );
  for (const stream of plan.workstreams) {
    assert.ok(stream.orderIds.includes(stream.agentDecision!.firstOrderId));
    assert.ok(stream.agentDecision!.justification.length >= 15);
  }
  assert.equal(
    state.tasks.length,
    0,
    "Plano não deve alegar tarefas individuais criadas.",
  );
  const first = plan.workstreams[0].agentDecision!.firstOrderId;
  const investigation = await investigate(
    { type: "order", target: first, requestId: randomUUID() },
    id,
    dataset,
    () => {},
  );
  measured("Pedido individual", investigation);
  const persisted = (await getSession(id))!;
  assert.ok(
    persisted.tasks.some(
      (task) =>
        investigation.taskIds.includes(task.id) && task.orderId === first,
    ),
  );
  const recurrenceDataset: Dataset = {
    ...dataset,
    orders: Array.from({ length: 30 }, (_, i) => ({
      ...order,
      id: `DEMO-REC-${i}`,
      exception: i < 12 ? "item_faltante" : "atraso_entrega",
      shift: i < 12 ? "noite" : "manhã",
    })),
  };
  const recurrence = await investigate(
    { type: "recurrences", target: "base", requestId: randomUUID() },
    id,
    recurrenceDataset,
    () => {},
  );
  measured("Descoberta de recorrências", recurrence);
  assert.ok(recurrence.recurrenceReview);
  assert.ok(recurrence.consultedInsightIds?.length);
  assert.ok(recurrence.taskIds.length <= 3);
  const processPattern = insights(recurrenceDataset).find(
    (item) => item.scope === "process",
  )!;
  const processRun = await investigate(
    { type: "pattern", target: processPattern.id, requestId: randomUUID() },
    id,
    recurrenceDataset,
    () => {},
  );
  measured("Investigação de processo", processRun);
  const repeated = await investigate(
    { type: "recurrences", target: "base", requestId: randomUUID() },
    id,
    recurrenceDataset,
    () => {},
  );
  measured("Reanálise com registros anteriores", repeated);
  assert.deepEqual(
    repeated.taskIds.filter(
      (taskId) =>
        ![...recurrence.taskIds, ...processRun.taskIds].includes(taskId),
    ),
    [],
  );
  await verifyLarge(id);
  console.log(
    "Groq real: análise de recorrências e cobertura consultada persistidas: OK",
  );
  console.log(
    "Groq real com dados fictícios próprios: seleção preservada → escolha evidenciada por área → plano persistido → investigação do caso escolhido → tarefa persistida: OK",
  );
}
main()
  .catch((error) => {
    console.error(
      error instanceof assert.AssertionError
        ? error.message
        : "Falha no teste de integração fictício.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await rm(directory, { recursive: true, force: true });
  });
