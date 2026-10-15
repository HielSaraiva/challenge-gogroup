import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.SMOKE_URL || "http://localhost:3000";
async function newSession() {
  const response = await fetch(`${base}/api/session`);
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "Cookie de sessão deve ser emitido"); return cookie;
}
async function read(route, cookie) {
  const r = await fetch(`${base}${route}`, { headers: { cookie } }); assert.equal(r.status, 200); return r.json();
}
async function main() {
  const cookie = await newSession(); const second = await newSession();
  const dashboard = await read("/api/dashboard", cookie); assert.equal(dashboard.count, 2000); assert.equal(dashboard.value, "220161.37");
  const queue = await read("/api/queue", cookie); assert.equal(queue.orders.length, 150); assert.equal(queue.fifo.count, 150);
  const invalid = await fetch(`${base}/api/queue?value=0&urgency=0&relationship=0`, { headers: { cookie } }); assert.equal(invalid.status, 400);
  const forbidden = await fetch(`${base}/api/tasks`, { method: "PATCH", headers: { cookie, origin: "https://invalid.example", "content-type": "application/json" }, body: "{}" }); assert.equal(forbidden.status, 403);
  assert.equal((await read("/api/tasks", second)).length, 0);
  if (process.argv.includes("--agent")) {
    const patterns = await read("/api/insights", cookie);
    const pattern = patterns.find(p => p.id.startsWith("falha_personalizacao:machine:"));
    const input = { type: "pattern", target: pattern.id, requestId: randomUUID() };
    const response = await fetch(`${base}/api/investigations`, { method: "POST", headers: { cookie, origin: base, "content-type": "application/json" }, body: JSON.stringify(input) });
    assert.equal(response.status, 200);
    const messages = (await response.text()).trim().split("\n").map(line => JSON.parse(line));
    const run = messages.findLast(m => m.investigation)?.investigation;
    assert.equal(run?.status, "completed", "Groq deve concluir a investigação real"); assert.ok(run.taskIds.length > 0);
    const tasks = await read("/api/tasks", cookie); assert.ok(tasks.some(t => run.taskIds.includes(t.id)));
    assert.equal((await read("/api/tasks", second)).length, 0, "Sessão diferente não deve ver tarefas");
    const persisted = await read("/api/investigations", cookie); assert.ok(persisted.some(r => r.id === run.id));
    const replay = await fetch(`${base}/api/investigations`, { method: "POST", headers: { cookie, origin: base, "content-type": "application/json" }, body: JSON.stringify(input) });
    assert.equal((await replay.json()).investigation.id, run.id);
    assert.equal((await read("/api/tasks", cookie)).length, tasks.length, "Repetição não deve criar novas tarefas");
    const task = tasks[0];
    const update = await fetch(`${base}/api/tasks`, { method: "PATCH", headers: { cookie, origin: base, "content-type": "application/json" }, body: JSON.stringify({ id: task.id, status: task.status === "pendente_aprovacao" ? "aprovada" : "concluida" }) });
    assert.equal(update.status, 200);
    const reset = await fetch(`${base}/api/session`, { method: "POST", headers: { cookie, origin: base, "content-type": "application/json" }, body: "{}" });
    assert.equal(reset.status, 200);
    const resetCookie = reset.headers.get("set-cookie")?.split(";")[0]; assert.ok(resetCookie); assert.notEqual(resetCookie, cookie);
    assert.equal((await read("/api/tasks", resetCookie)).length, 0);
    console.log("Groq real: padrão → consulta de pedido → tarefa → persistência → isolamento → idempotência → conclusão → nova sessão: OK");
  }
  console.log("HTTP: dashboard, fila, validação de pesos, origem e isolamento: OK");
}
main().catch(e => { console.error(e instanceof assert.AssertionError ? e.message : "Falha de conexão na verificação HTTP."); process.exitCode = 1; });
