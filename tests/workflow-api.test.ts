import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createSession,
  getSession,
  saveSessionDataset,
  upsertTask,
} from "@/server/store";
import { executeTool, type AgentContext } from "@/server/agent";
import { GET as queueGET } from "@/app/api/queue/route";
import { PATCH as taskPATCH } from "@/app/api/tasks/route";
import { PATCH as orderPATCH } from "@/app/api/orders/route";
import { GET as operationsGET } from "@/app/api/operations/route";
import type { Dataset, Task } from "@/domain/types";
import { sessionDataset } from "@/domain/cases";
import { awaitingResultOrders } from "@/domain/task-resolution";
let sessionId = "";
vi.mock("@/server/http", async (original) => ({
  ...(await original<typeof import("@/server/http")>()),
  session: async () => ({
    id: sessionId,
    state: (await getSession(sessionId))!,
  }),
}));
const data: Dataset = {
  importedAt: "2026-09-30T10:00:00Z",
  sourceRows: 2,
  customers: [
    {
      id: "SYN-C",
      orders: 2,
      revenue: "200.00",
      firstOrder: "2026-09-01",
      contacts: 0,
    },
  ],
  carriers: [
    { name: "Transportadora sintética", state: "SP", sla: 3, freight: "12.00" },
  ],
  orders: ["SYN-A", "SYN-B"].map((id) => ({
    id,
    customerId: "SYN-C",
    brand: "Marca sintética",
    orderedAt: "2026-09-01",
    value: "100.00",
    sku: "SYN",
    product: "Produto sintético",
    quantity: 1,
    gift: false,
    exception: "endereco_divergente",
    sourceStatuses: ["aberta"],
    status: "aberta",
    carrier: "Transportadora sintética",
    state: "SP",
    city: "Cidade sintética",
    promisedAt: "2026-09-08",
    deliveredAt: null,
    machine: "",
    shift: "manhã",
    dc: "CD-SYN",
    lot: "L-SYN",
    openedAt: "2026-09-09",
    issues: [],
  })),
};
const request = (path: string, body: unknown) =>
  new Request(`http://localhost:3000/api/${path}`, {
    method: "PATCH",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
const context = (mode: AgentContext["mode"]): AgentContext => ({
  sessionId,
  runId: randomUUID(),
  data,
  mode,
  allowedIds: new Set(data.orders.map((o) => o.id)),
  consulted: new Set(),
  simulated: new Set(),
  evidence: new Set(),
});
beforeEach(async () => {
  sessionId = randomUUID();
  await createSession(sessionId);
  await saveSessionDataset(sessionId, data);
});
describe("fluxo persistido pelos endpoints", () => {
  const newTask = (patch: Partial<Task> = {}): Task => ({
    id: randomUUID(),
    investigationId: randomUUID(),
    orderId: "SYN-A",
    kind: "revisao_cadastral",
    title: "Conferir endereço",
    justification: "Validar o endereço antes de liberar o atendimento",
    evidenceIds: ["SYN-A"],
    area: "Atendimento",
    dueAt: "2026-10-01",
    status: "aberta",
    createdAt: "2026-09-30T10:00:00Z",
    updatedAt: "2026-09-30T10:00:00Z",
    idempotencyKey: randomUUID(),
    ...patch,
  });
  const execution = {
    note: "Endereço conferido e correção registrada no sistema",
    evidence: "Chamado sintético com confirmação da correção cadastral",
  };
  it("registra execução sem encerrar e mantém pedido aguardando resultado", async () => {
    const task = newTask();
    await upsertTask(sessionId, task);
    expect(
      (
        await taskPATCH(
          request("tasks", { id: task.id, status: "concluida", execution }),
        )
      ).status,
    ).toBe(200);
    const state = (await getSession(sessionId))!;
    expect(state.tasks[0].status).toBe("concluida");
    expect(state.cases?.["SYN-A"]?.resolution).toBeUndefined();
    expect(
      awaitingResultOrders(sessionDataset(data, state).orders, state.tasks).map(
        (order) => order.id,
      ),
    ).toEqual(["SYN-A"]);
    const response = await orderPATCH(
      request("orders", {
        action: "resolve",
        orderId: "SYN-A",
        note: execution.note,
        outcome: {
          type: "endereco_corrigido",
          evidence: execution.evidence,
          evidenceTaskId: task.id,
        },
      }),
    );
    expect(response.status).toBe(200);
    const closed = (await getSession(sessionId))!;
    expect(
      awaitingResultOrders(sessionDataset(data, closed).orders, closed.tasks),
    ).toEqual([]);
  });
  it("salva execução e resultado juntos, vinculando a evidência sem duplicar formulário", async () => {
    const task = newTask();
    await upsertTask(sessionId, task);
    const response = await taskPATCH(
      request("tasks", {
        id: task.id,
        status: "concluida",
        execution,
        resolution: {
          type: "endereco_corrigido",
          evidence: execution.evidence,
          evidenceTaskId: task.id,
        },
      }),
    );
    expect(response.status).toBe(200);
    const state = (await getSession(sessionId))!;
    expect(state.tasks[0].execution?.note).toBe(execution.note);
    expect(state.cases?.["SYN-A"].resolution?.outcome).toMatchObject({
      evidenceTaskId: task.id,
      evidence: execution.evidence,
    });
    expect(state.cases?.["SYN-A"].history).toHaveLength(1);
  });
  it.each([
    [
      "resultado incompatível",
      {
        type: "reembolso_registrado",
        refund: "50.00",
        evidence: execution.evidence,
      },
    ],
    [
      "referência de evidência inválida",
      {
        type: "endereco_corrigido",
        evidence: execution.evidence,
        evidenceTaskId: "outra-tarefa",
      },
    ],
  ])(
    "rejeita %s sem concluir parcialmente a tarefa",
    async (_label, resolution) => {
      const task = newTask();
      await upsertTask(sessionId, task);
      const response = await taskPATCH(
        request("tasks", {
          id: task.id,
          status: "concluida",
          execution,
          resolution,
        }),
      );
      expect(response.status).toBe(409);
      const state = (await getSession(sessionId))!;
      expect(state.tasks[0].status).toBe("aberta");
      expect(state.tasks[0].execution).toBeUndefined();
      expect(state.cases?.["SYN-A"]).toBeUndefined();
    },
  );
  it("não permite encerrar com aprovação pendente ou outras tarefas abertas", async () => {
    const task = newTask();
    await upsertTask(sessionId, task);
    await upsertTask(sessionId, newTask());
    const response = await taskPATCH(
      request("tasks", {
        id: task.id,
        status: "concluida",
        execution,
        resolution: {
          type: "endereco_corrigido",
          evidence: execution.evidence,
        },
      }),
    );
    expect(response.status).toBe(409);
    expect(
      (await getSession(sessionId))!.tasks.every(
        (task) => task.status === "aberta",
      ),
    ).toBe(true);
  });
  it("não converte proposta sem aprovação em execução com encerramento", async () => {
    const task = newTask({ status: "pendente_aprovacao" });
    await upsertTask(sessionId, task);
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            execution,
            resolution: {
              type: "endereco_corrigido",
              evidence: execution.evidence,
            },
          }),
        )
      ).status,
    ).toBe(409);
    expect((await getSession(sessionId))!.tasks[0].status).toBe(
      "pendente_aprovacao",
    );
  });
  it("exibe plano somente após as ferramentas e exige execução e resultado no encerramento", async () => {
    expect(await (await queueGET()).json()).toMatchObject({
      status: "not_prepared",
      orders: [],
    });
    const ctx = context("daily");
    await executeTool("consultar_diagnostico", {}, ctx);
    await executeTool(
      "comparar_estrategias",
      {
        strategy: "urgencia",
        reason:
          "Priorizar a espera das pendências e preservar a clareza do encaminhamento.",
      },
      ctx,
    );
    await executeTool(
      "registrar_plano_dia",
      {
        briefing:
          "Organizar a confirmação dos endereços com as referências disponíveis na amostra.",
        priorityAreas: ["Atendimento"],
        instructions: [
          {
            area: "Atendimento",
            firstOrderId: "SYN-A",
            justification:
              "Conferir primeiro a divergência de endereço registrada neste caso da amostra.",
            nextStep:
              "Consultar o cadastro original e encaminhar a confirmação dos dados ao responsável.",
          },
        ],
      },
      ctx,
    );
    const before = await (await queueGET()).json();
    expect(before.status).toBe("ready");
    expect(before.orders).toHaveLength(2);
    const orderCtx = context("order");
    await executeTool("consultar_pedido", { orderId: "SYN-A" }, orderCtx);
    const task = (await executeTool(
      "criar_tarefa",
      {
        orderId: "SYN-A",
        kind: "revisao_cadastral",
        title: "Confirmar endereço do pedido",
        justification:
          "Conferir a referência cadastral antes de liberar o encaminhamento.",
        evidenceIds: ["SYN-A"],
      },
      orderCtx,
    )) as Task;
    expect(
      (await taskPATCH(request("tasks", { id: task.id, status: "concluida" })))
        .status,
    ).toBe(400);
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            execution: {
              note: "Endereço confirmado e atualizado na origem",
              evidence: "Registro sintético de confirmação cadastral",
            },
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: "Tratativa cadastral concluída",
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: "Tratativa cadastral concluída",
            outcome: {
              type: "entrega_confirmada",
              evidence: "Referência sintética incompatível",
            },
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await orderPATCH(
          request("orders", {
            action: "resolve",
            orderId: "SYN-A",
            note: "Tratativa cadastral concluída",
            outcome: {
              type: "endereco_corrigido",
              evidence: "Registro sintético do endereço confirmado",
            },
          }),
        )
      ).status,
    ).toBe(200);
    const after = await (await queueGET()).json();
    expect(after.orders.map((o: { id: string }) => o.id)).toEqual(["SYN-B"]);
    expect(after.completed).toBe(1);
    expect(after.plan.comparison).toEqual(before.plan.comparison);
    const report = await (
      await operationsGET(new Request("http://localhost:3000/api/operations"))
    ).json();
    expect(report.financial.unmeasured).toBe(1);
    expect(report.financial.declaredCosts.count).toBe(0);
    const first = sessionId;
    sessionId = randomUUID();
    await createSession(sessionId);
    await saveSessionDataset(sessionId, data);
    expect((await (await queueGET()).json()).status).toBe("not_prepared");
    expect((await getSession(sessionId))!.tasks).toHaveLength(0);
    expect((await getSession(first))!.tasks).toHaveLength(1);
  });
  it("documenta investigação com referências válidas sem resolver os pedidos", async () => {
    const task: Task = {
      id: randomUUID(),
      investigationId: randomUUID(),
      orderId: "SYN-A",
      kind: "melhoria_processo",
      scope: "process",
      affectedOrderIds: ["SYN-A", "SYN-B"],
      title: "Conferir recorrência cadastral",
      justification: "Validar o fluxo de cadastro com a equipe responsável.",
      evidenceIds: ["SYN-A", "SYN-B"],
      area: "Atendimento",
      dueAt: "2026-10-02",
      status: "aberta",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      idempotencyKey: randomUUID(),
    };
    await upsertTask(sessionId, task);
    expect(
      (await taskPATCH(request("tasks", { id: task.id, status: "concluida" })))
        .status,
    ).toBe(400);
    const conclusion = {
      outcome: "inconclusiva",
      observations:
        "Amostra conferida; ainda faltam registros da origem para validar o fluxo.",
      nextStep: "Solicitar histórico do cadastro para a área responsável",
      evidenceIds: ["SYN-A", "SYN-A"],
    };
    expect(
      (
        await taskPATCH(
          request("tasks", { id: task.id, status: "concluida", conclusion }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            conclusion: { ...conclusion, evidenceIds: ["SYN-A", "SYN-B"] },
          }),
        )
      ).status,
    ).toBe(200);
    expect((await getSession(sessionId))!.cases || {}).toEqual({});
  });
  it("permite documentar um legado, sem preencher evidências automaticamente", async () => {
    const task: Task = {
      id: randomUUID(),
      investigationId: randomUUID(),
      orderId: "SYN-A",
      kind: "revisao_cadastral",
      title: "Registro legado",
      justification: "Registro anterior ao novo contrato",
      evidenceIds: ["SYN-A"],
      area: "Atendimento",
      dueAt: "2026-10-01",
      status: "concluida",
      createdAt: "",
      updatedAt: "",
      idempotencyKey: randomUUID(),
    };
    await upsertTask(sessionId, task);
    expect((await getSession(sessionId))!.tasks[0].execution).toBeUndefined();
    expect(
      (
        await taskPATCH(
          request("tasks", {
            id: task.id,
            status: "concluida",
            execution: {
              note: "Execução antiga conferida pelo operador",
              evidence:
                "Referência sintética conferida para documentar o legado",
            },
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await getSession(sessionId))!.tasks[0].execution?.evidence,
    ).toContain("Referência");
  });
});
