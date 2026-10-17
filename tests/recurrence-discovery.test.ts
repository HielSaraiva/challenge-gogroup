import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  executeTool,
  investigate,
  type AgentCompletion,
  type AgentContext,
} from "@/server/agent";
import { createSession, getSession, updateTask } from "@/server/store";
import type { Dataset, Order } from "@/domain/types";

const base: Order = {
  id: "REC-CASE",
  customerId: "REC-CUSTOMER",
  brand: "Marca fictícia",
  orderedAt: "2026-09-01",
  value: "100.00",
  sku: "REC-SKU",
  product: "Item fictício",
  quantity: 1,
  gift: false,
  exception: "item_faltante",
  sourceStatuses: ["aberta"],
  status: "aberta",
  carrier: "Transporte fictício",
  state: "SP",
  city: "Cidade",
  promisedAt: "2026-09-08",
  deliveredAt: null,
  machine: "",
  shift: "noite",
  dc: "CD1",
  lot: "REC-LOT",
  openedAt: "2026-09-09",
  issues: [],
};
const data: Dataset = {
  orders: Array.from({ length: 30 }, (_, i) => ({
    ...base,
    id: `REC-${i}`,
    exception: i < 12 ? "item_faltante" : "atraso_entrega",
    shift: i < 12 ? "noite" : "manhã",
  })),
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
  importedAt: "2026-09-30",
  sourceRows: 30,
};
const reason =
  "A concentração na separação merece verificação por apresentar associação relevante e referências para conferência.";
const proposal = {
  title: "Conferir a separação no turno da noite",
  justification:
    "A concentração pode estar relacionada à conferência da separação, mas precisa ser validada nos registros operacionais.",
  nextStep:
    "Comparar os romaneios e a conferência dos itens com outros turnos antes de concluir a causa.",
};
const completion = (name: string, args: unknown) => ({
  choices: [
    {
      message: {
        content: null,
        tool_calls: [
          {
            id: randomUUID(),
            type: "function" as const,
            function: { name, arguments: JSON.stringify(args) },
          },
        ],
      },
    },
  ],
});
beforeAll(() => {
  process.env.LOCAL_DEMO = "true";
  process.env.GROQ_API_KEY = "synthetic-test-only";
});
async function setup() {
  const id = randomUUID().replaceAll("-", "");
  await createSession(id);
  const context: AgentContext = {
    sessionId: id,
    runId: randomUUID(),
    mode: "recurrences",
    data,
    allowedIds: new Set(data.orders.map((o) => o.id)),
    consulted: new Set(),
    simulated: new Set(),
    evidence: new Set(),
  };
  return { id, context };
}
function mockSelection(empty = false): AgentCompletion {
  let calls = 0;
  return async (messages) => {
    if (calls++ === 0) return completion("consultar_recorrencias", {});
    const facts = JSON.parse(String(messages.at(-1)?.content));
    const first = facts.candidates[0];
    expect(first).not.toHaveProperty("title");
    expect(first).not.toHaveProperty("hypothesis");
    return completion("registrar_analise_recorrencias", {
      reason,
      proposals: empty
        ? []
        : [
            {
              ...proposal,
              insightId: first.insightId,
              evidenceIds: first.sample
                .slice(0, 2)
                .map((o: { id: string }) => o.id),
            },
          ],
    });
  };
}
describe("descoberta de recorrências pelo agente", () => {
  it("compara dados calculados e persiste título, hipótese e próximo passo produzidos pelo agente", async () => {
    const { id } = await setup();
    const run = await investigate(
      { type: "recurrences", target: "base", requestId: randomUUID() },
      id,
      data,
      () => {},
      mockSelection(),
    );
    expect(run.status).toBe("completed");
    expect(run.recurrenceReview?.reason).toBe(reason);
    expect(run.taskIds).toHaveLength(1);
    const state = (await getSession(id))!;
    expect(state.tasks[0]).toMatchObject({
      title: proposal.title,
      justification: `Hipótese do agente: ${proposal.justification}`,
      nextStep: proposal.nextStep,
      scope: "process",
      status: "aberta",
    });
    expect(state.tasks[0].facts?.[0]).toContain("12 de 12");
    expect(
      state.investigations[0].recurrenceReview?.selectedInsightIds,
    ).toHaveLength(1);
  });
  it("permite finalizar sem achados e não cria cards ou tarefas artificiais", async () => {
    const { id } = await setup();
    const run = await investigate(
      { type: "recurrences", target: "base", requestId: randomUUID() },
      id,
      data,
      () => {},
      mockSelection(true),
    );
    expect(run.status).toBe("completed");
    expect(run.taskIds).toEqual([]);
    expect(run.recurrenceReview?.selectedInsightIds).toEqual([]);
    expect((await getSession(id))!.tasks).toEqual([]);
  });
  it("preserva a conclusão da equipe quando outra análise seleciona o mesmo grupo", async () => {
    const { id } = await setup();
    const first = await investigate(
      { type: "recurrences", target: "base", requestId: randomUUID() },
      id,
      data,
      () => {},
      mockSelection(),
    );
    await updateTask(id, first.taskIds[0], "concluida", undefined, {
      outcome: "inconclusiva",
      observations:
        "Os registros sintéticos ainda não sustentam uma causa definitiva.",
      nextStep:
        "Conferir o procedimento de separação com a equipe responsável.",
      evidenceIds: ["REC-0", "REC-1"],
    });
    const second = await investigate(
      { type: "recurrences", target: "base", requestId: randomUUID() },
      id,
      data,
      () => {},
      mockSelection(),
    );
    const state = (await getSession(id))!;
    expect(second.status).toBe("completed");
    expect(state.tasks).toHaveLength(1);
    expect(second.recurrenceReview?.reusedTaskIds).toEqual(first.taskIds);
    expect(state.tasks[0].conclusion?.outcome).toBe("inconclusiva");
  });
  it("rejeita seleção sem consulta, evidências inventadas e duplicação antes de gravar", async () => {
    const { id, context } = await setup();
    await expect(
      executeTool(
        "registrar_analise_recorrencias",
        { reason, proposals: [] },
        context,
      ),
    ).rejects.toThrow("Consulte");
    const listing = (await executeTool(
      "consultar_recorrencias",
      {},
      context,
    )) as { candidates: { insightId: string; sample: { id: string }[] }[] };
    const first = listing.candidates[0];
    const valid = {
      ...proposal,
      insightId: first.insightId,
      evidenceIds: first.sample.slice(0, 2).map((o) => o.id),
    };
    await expect(
      executeTool(
        "registrar_analise_recorrencias",
        { reason, proposals: [valid, { ...valid, insightId: "invented" }] },
        context,
      ),
    ).rejects.toThrow("distintos e consultados");
    await expect(
      executeTool(
        "registrar_analise_recorrencias",
        { reason, proposals: [{ ...valid, evidenceIds: ["REC-0", "REC-29"] }] },
        context,
      ),
    ).rejects.toThrow("amostra");
    await expect(
      executeTool(
        "registrar_analise_recorrencias",
        { reason, proposals: [valid, valid] },
        context,
      ),
    ).rejects.toThrow("distintos");
    expect((await getSession(id))!.tasks).toHaveLength(0);
  });
  it("não inventa recorrências quando nenhum agrupamento é elegível", async () => {
    const { id } = await setup();
    const emptyData = { ...data, orders: [data.orders[0]], sourceRows: 1 };
    let called = false;
    const provider: AgentCompletion = async (messages) => {
      if (!called) {
        called = true;
        return completion("consultar_recorrencias", {});
      }
      const facts = JSON.parse(String(messages.at(-1)?.content));
      expect(facts.candidates).toEqual([]);
      return completion("registrar_analise_recorrencias", {
        reason:
          "Não há agrupamentos com evidências suficientes para propor uma investigação de recorrência.",
        proposals: [],
      });
    };
    const run = await investigate(
      { type: "recurrences", target: "base", requestId: randomUUID() },
      id,
      emptyData,
      () => {},
      provider,
    );
    expect(run.status).toBe("completed");
    expect(run.taskIds).toEqual([]);
    expect((await getSession(id))!.tasks).toEqual([]);
  });
  it("evita duplicação por grupos diferentes que cobrem os mesmos pedidos", async () => {
    const { id, context } = await setup();
    context.data = {
      ...data,
      orders: data.orders.map((order, index) => ({
        ...order,
        gift: index < 12,
      })),
    };
    const listing = (await executeTool(
      "consultar_recorrencias",
      {},
      context,
    )) as { candidates: { insightId: string; sample: { id: string }[] }[] };
    expect(listing.candidates.length).toBeGreaterThanOrEqual(2);
    const proposals = listing.candidates.slice(0, 2).map((candidate) => ({
      ...proposal,
      insightId: candidate.insightId,
      evidenceIds: candidate.sample.slice(0, 2).map((order) => order.id),
    }));
    await expect(
      executeTool(
        "registrar_analise_recorrencias",
        { reason, proposals },
        context,
      ),
    ).rejects.toThrow("mesmos pedidos");
    expect((await getSession(id))!.tasks).toEqual([]);
    await executeTool(
      "registrar_analise_recorrencias",
      { reason, proposals: [proposals[0]] },
      context,
    );
    const fresh = {
      ...context,
      runId: randomUUID(),
      recurrenceReview: undefined,
      recurrenceTaskIds: undefined,
    };
    const result = (await executeTool(
      "registrar_analise_recorrencias",
      { reason, proposals: [proposals[1]] },
      fresh,
    )) as { reusedTaskIds: string[] };
    expect((await getSession(id))!.tasks).toHaveLength(1);
    expect(result.reusedTaskIds).toHaveLength(1);
  });
  it("registra falha do provedor sem gerar propostas de substituição", async () => {
    const { id } = await setup();
    const run = await investigate(
      { type: "recurrences", target: "base", requestId: randomUUID() },
      id,
      data,
      () => {},
      async () => {
        throw new Error("synthetic failure");
      },
    );
    expect(run.status).toBe("failed");
    expect(run.recurrenceReview).toBeUndefined();
    expect((await getSession(id))!.tasks).toEqual([]);
  });
});
