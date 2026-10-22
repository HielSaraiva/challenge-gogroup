import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { data as fixture } from "../tests/browser/fixtures";
import { investigate } from "../src/server/agent";
import {
  createSession,
  getSession,
} from "../src/infrastructure/persistence/operations-store";
import { queue } from "../src/domain/analytics";
import { STRATEGIES } from "../src/domain/types";

async function main() {
  const directory = await mkdtemp(path.join(tmpdir(), "gogroup-daily-"));
  Object.assign(process.env, {
    NODE_ENV: "test",
    OPERATIONS_TEST_DIRECTORY: directory,
    DATABASE_URL: "",
  });
  try {
    const exceptions = [
      "endereco_divergente",
      "pagamento_pendente",
      "ruptura_pos_venda",
      "falha_personalizacao",
      "item_faltante",
      "vazamento_produto",
      "atraso_entrega",
      "extravio",
    ];
    const data = {
      ...fixture,
      orders: Array.from({ length: 150 }, (_, i) => ({
        ...fixture.orders[0],
        id: `DAILY-${i}`,
        exception: exceptions[i % exceptions.length],
        status: i < 10 ? "status_divergente" : "aberta",
        sourceStatuses: i < 10 ? ["aberta", "em_analise"] : ["aberta"],
      })),
      sourceRows: 150,
    };
    const id = randomUUID();
    await createSession(id);
    const started = Date.now();
    const run = await investigate(
      {
        type: "daily",
        target: "day",
        requestId: randomUUID(),
        strategy: "equilibrada",
      },
      id,
      data,
      () => {},
    );
    if (run.status !== "completed")
      console.log(
        JSON.stringify({
          usage: run.tokenUsage,
          events: run.events.map((e) => ({
            tool: e.tool,
            state: e.state,
            message: e.state === "error" ? e.message : undefined,
          })),
        }),
      );
    assert.equal(run.status, "completed", run.summary);
    assert.equal(
      run.tokenUsage?.requests,
      1,
      "O plano deve ser registrado na primeira resposta real do modelo.",
    );
    const plan = (await getSession(id))!.plans![0];
    assert.ok(plan);
    assert.equal(plan.workstreams.length, 8);
    assert.deepEqual(
      plan.selectedOrderIds,
      queue(data, STRATEGIES.equilibrada.weights).orders.map((o) => o.id),
    );
    console.log(
      JSON.stringify({
        result: "Plano completo persistido na primeira chamada Groq",
        areas: plan.workstreams.length,
        selected: plan.selectedOrderIds.length,
        usage: run.tokenUsage,
        elapsedMs: Date.now() - started,
      }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
void main().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Falha na verificação sintética do plano diário.",
  );
  process.exitCode = 1;
});
