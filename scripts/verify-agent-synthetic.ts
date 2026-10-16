import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { rm } from "node:fs/promises";
import type { Dataset, Order } from "../src/domain/types";
import { investigate } from "../src/server/agent";
import { createSession, getSession } from "../src/server/store";
import { queue } from "../src/domain/analytics";

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
async function main() {
  assert.ok(
    process.env.GROQ_API_KEY,
    "Configure GROQ_API_KEY para o teste real com dados fictícios.",
  );
  const id = randomUUID();
  await createSession(id);
  const run = await investigate(
    { type: "daily", target: "day", requestId: randomUUID() },
    id,
    dataset,
    () => {},
  );
  assert.equal(run.status, "completed", run.summary);
  const state = (await getSession(id))!;
  const plan = state.plans!.find((item) => item.id === run.planId)!;
  assert.ok(plan);
  assert.deepEqual(
    plan.selectedOrderIds,
    queue(dataset).orders.map((item) => item.id),
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
  assert.equal(investigation.status, "completed", investigation.summary);
  const persisted = (await getSession(id))!;
  assert.ok(
    persisted.tasks.some(
      (task) =>
        investigation.taskIds.includes(task.id) && task.orderId === first,
    ),
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
