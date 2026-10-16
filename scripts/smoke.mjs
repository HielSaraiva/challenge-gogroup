import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.SMOKE_URL || "http://localhost:3000";
async function newSession() {
  const response = await fetch(`${base}/api/session`);
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Cookie de sessão deve ser emitido");
  return cookie;
}
async function read(route, cookie) {
  const r = await fetch(`${base}${route}`, { headers: { cookie } });
  assert.equal(r.status, 200);
  return r.json();
}
async function main() {
  const cookie = await newSession();
  const second = await newSession();
  const dashboard = await read("/api/dashboard", cookie);
  assert.ok(dashboard.count > 0, "Base importada deve conter pedidos");
  assert.ok(Number(dashboard.value) >= 0);
  const queue = await read("/api/queue", cookie);
  assert.equal(queue.orders.length, Math.min(queue.capacity, dashboard.count));
  assert.equal(queue.fifo.count, queue.orders.length);
  const invalid = await fetch(
    `${base}/api/queue?value=0&urgency=0&relationship=0`,
    { headers: { cookie } },
  );
  assert.equal(invalid.status, 400);
  const forbidden = await fetch(`${base}/api/tasks`, {
    method: "PATCH",
    headers: {
      cookie,
      origin: "https://invalid.example",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(forbidden.status, 403);
  assert.equal((await read("/api/tasks", second)).length, 0);
  if (process.argv.includes("--agent")) {
    const order = queue.orders.find((o) => o.status !== "status_divergente");
    assert.ok(order);
    const input = {
      type: "order",
      target: order.id,
      requestId: randomUUID(),
    };
    const response = await fetch(`${base}/api/investigations`, {
      method: "POST",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, 200);
    const messages = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const run = messages.findLast((m) => m.investigation)?.investigation;
    assert.equal(
      run?.status,
      "completed",
      "Groq deve concluir a investigação real",
    );
    assert.ok(run.taskIds.length > 0);
    const tasks = await read("/api/tasks", cookie);
    assert.ok(tasks.some((t) => run.taskIds.includes(t.id)));
    assert.equal(
      (await read("/api/tasks", second)).length,
      0,
      "Sessão diferente não deve ver tarefas",
    );
    const persisted = await read("/api/investigations", cookie);
    assert.ok(persisted.some((r) => r.id === run.id));
    const replay = await fetch(`${base}/api/investigations`, {
      method: "POST",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal((await replay.json()).investigation.id, run.id);
    assert.equal(
      (await read("/api/tasks", cookie)).length,
      tasks.length,
      "Repetição não deve criar novas tarefas",
    );
    const task = tasks[0];
    const update = await fetch(`${base}/api/tasks`, {
      method: "PATCH",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: JSON.stringify({
        id: task.id,
        status: task.status === "pendente_aprovacao" ? "aprovada" : "concluida",
      }),
    });
    assert.equal(update.status, 200);
    const orderBefore = (await read(`/api/orders?id=${task.orderId}`, cookie))
      .orders[0];
    if (orderBefore.status === "status_divergente") {
      const review = await fetch(`${base}/api/orders`, {
        method: "PATCH",
        headers: { cookie, origin: base, "content-type": "application/json" },
        body: JSON.stringify({
          action: "review_status",
          orderId: task.orderId,
          status: orderBefore.sourceStatuses[0],
          note: "Status verificado durante o teste de integração.",
        }),
      });
      assert.equal(review.status, 200);
    }
    const resolution = await fetch(`${base}/api/orders`, {
      method: "PATCH",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: JSON.stringify({
        action: "resolve",
        orderId: task.orderId,
        note: "Tratativa concluída no teste da demonstração.",
      }),
    });
    assert.equal(resolution.status, 200, "Deve encerrar após tarefa concluída");
    assert.equal((await read("/api/dashboard", cookie)).resolvedCount, 1);
    assert.equal((await read("/api/dashboard", second)).resolvedCount, 0);
    assert.ok(
      !(await read("/api/queue", cookie)).orders.some(
        (order) => order.id === task.orderId,
      ),
    );
    const reopen = await fetch(`${base}/api/orders`, {
      method: "PATCH",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: JSON.stringify({
        action: "reopen",
        orderId: task.orderId,
        note: "Reabertura para validar o histórico da demonstração.",
      }),
    });
    assert.equal(reopen.status, 200);
    assert.equal((await read("/api/dashboard", cookie)).resolvedCount, 0);
    const reset = await fetch(`${base}/api/session`, {
      method: "POST",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(reset.status, 200);
    const resetCookie = reset.headers.get("set-cookie")?.split(";")[0];
    assert.ok(resetCookie);
    assert.notEqual(resetCookie, cookie);
    assert.equal((await read("/api/tasks", resetCookie)).length, 0);
    console.log(
      "Groq real: pedido → tarefa → persistência → isolamento → idempotência → conclusão → nova sessão: OK",
    );
  }
  if (
    ["--strategic", "--plan", "--process"].some((flag) =>
      process.argv.includes(flag),
    )
  ) {
    async function investigate(type, target) {
      const response = await fetch(`${base}/api/investigations`, {
        method: "POST",
        headers: { cookie, origin: base, "content-type": "application/json" },
        body: JSON.stringify({ type, target, requestId: randomUUID() }),
      });
      assert.equal(response.status, 200);
      const events = (await response.text()).trim().split("\n").map(JSON.parse);
      const run = events.findLast(
        (event) => event.investigation,
      )?.investigation;
      assert.equal(
        run?.status,
        "completed",
        `Groq deve concluir ${type}: ${run?.error || run?.summary || "sem resultado"}`,
      );
      return run;
    }
    if (!process.argv.includes("--process")) {
      const daily = await investigate("daily", "today");
      assert.ok(daily.planId);
      const operations = await read("/api/operations", cookie);
      const plan = operations.plans.find((p) => p.id === daily.planId);
      assert.ok(plan);
      const currentQueue = await read("/api/queue", cookie);
      assert.deepEqual(
        [...plan.selectedOrderIds].sort(),
        currentQueue.orders.map((o) => o.id).sort(),
      );
      assert.deepEqual(
        plan.workstreams.flatMap((s) => s.orderIds).sort(),
        [...plan.selectedOrderIds].sort(),
      );
      assert.equal((await read("/api/operations", second)).plans.length, 0);
      console.log("Groq real: plano completo persistido e isolado: OK");
    }
    if (!process.argv.includes("--plan")) {
      const patterns = await read("/api/insights", cookie);
      const pattern = patterns.find((p) => p.scope === "process");
      assert.ok(pattern);
      const processRun = await investigate("pattern", pattern.id);
      const tasks = await read("/api/tasks", cookie);
      const task = tasks.find((t) => processRun.taskIds.includes(t.id));
      assert.equal(task?.scope, "process");
      assert.ok(task.affectedOrderIds.length > 1);
      assert.equal(
        (await read("/api/operations", cookie)).financial.verifiedRecovery,
        "0.00",
      );
      assert.equal((await read("/api/dashboard", cookie)).resolvedCount, 0);
      console.log(
        "Groq real: ação de processo com evidências; nenhuma recuperação automática: OK",
      );
    }
  }
  console.log(
    "HTTP: dashboard, fila, validação de pesos, origem e isolamento: OK",
  );
}
main().catch((e) => {
  console.error(
    e instanceof assert.AssertionError
      ? e.message
      : "Falha de conexão na verificação HTTP.",
  );
  process.exitCode = 1;
});
