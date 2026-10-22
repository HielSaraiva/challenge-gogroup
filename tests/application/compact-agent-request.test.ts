import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { data as fixture, tasks } from "../browser/fixtures";
import {
  createSession,
  getSession,
  upsertTask,
  updateTask,
} from "../../src/infrastructure/persistence/operations-store";
import { investigate } from "../../src/server/agent";
import { insights } from "../../src/domain/analytics";
import { compactConsultation } from "../../src/application/agent/compact-agent-request";
import { recurrenceWorkload } from "../fixtures/recurrences";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));
beforeEach(() => {
  create.mockReset();
  process.env.GROQ_API_KEY = "test-only";
});
const text = {
  title: "Conferir os registros da operação",
  justification:
    "A divergência merece conferência nos registros antes de confirmar a tratativa.",
  nextStep:
    "Comparar os registros de separação com a conferência no turno antes de concluir a causa.",
};
function response(name: string, args: unknown) {
  return {
    usage: { prompt_tokens: 700, completion_tokens: 200, total_tokens: 900 },
    choices: [
      {
        message: {
          tool_calls: [
            {
              id: randomUUID(),
              type: "function",
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  };
}
const input = (payload: any) =>
  JSON.parse(payload.messages[1].content.split("\nCorrija")[0]);
async function session() {
  const id = randomUUID();
  await createSession(id);
  return id;
}

it.each([
  ["endereco_divergente", "aberta", "revisao_cadastral"],
  ["item_faltante", "aberta", "proposta_reenvio"],
  ["pagamento_pendente", "aberta", "proposta_reembolso"],
  ["item_faltante", "status_divergente", "revisao_status"],
])(
  "creates a compatible %s action in one request, preserving financial approval and conflicts",
  async (exception, status, kind) => {
    const data = {
      ...fixture,
      orders: [{ ...fixture.orders[0], exception, status }],
    };
    create.mockImplementation(async (payload) => {
      const facts = input(payload);
      expect(facts.consultar_pedido.pedido.tipo).toBe(exception);
      expect(facts.consultar_pedido.pedido.status).toBe(status);
      expect(facts.consultar_pedido.indicadores).toHaveProperty("resendCost");
      expect(facts.consultar_pedido.indicadores).not.toHaveProperty("reasons");
      if (kind === "proposta_reenvio")
        expect(facts.simulacao_reenvio.executado).toBe(false);
      if (kind === "proposta_reembolso")
        expect(facts.simulacao_reembolso.executado).toBe(false);
      if (status === "status_divergente")
        expect(facts).not.toHaveProperty("simulacao_reenvio");
      return response("criar_tarefa", {
        orderId: "UI-A",
        kind,
        title: text.title,
        justification: text.justification,
        evidenceIds: ["UI-A"],
      });
    });
    const id = await session();
    const run = await investigate(
      { type: "order", target: "UI-A", requestId: randomUUID() },
      id,
      data,
      () => {},
    );
    expect(run.status).toBe("completed");
    expect(create).toHaveBeenCalledTimes(1);
    const payload = create.mock.calls[0][0];
    expect(payload.messages).toHaveLength(2);
    expect(payload.tools).toHaveLength(1);
    expect(payload.max_completion_tokens).toBe(1200);
    expect(JSON.stringify(payload).length).toBeLessThan(9000);
    const task = (await getSession(id))!.tasks[0];
    expect(task.kind).toBe(kind);
    expect(task.status).toBe(
      kind.startsWith("proposta") ? "pendente_aprovacao" : "aberta",
    );
    expect(data.orders[0]).not.toHaveProperty("resolution");
  },
);

it("rejects invented evidence and corrects once without resending the transcript", async () => {
  const args = {
    orderId: "UI-A",
    kind: "revisao_cadastral",
    title: text.title,
    justification: text.justification,
    evidenceIds: ["OUTSIDE"],
  };
  create
    .mockResolvedValueOnce(response("criar_tarefa", args))
    .mockResolvedValueOnce(
      response("criar_tarefa", { ...args, evidenceIds: ["UI-A"] }),
    );
  const id = await session();
  const run = await investigate(
    { type: "order", target: "UI-A", requestId: randomUUID() },
    id,
    fixture,
    () => {},
  );
  expect(run.status).toBe("completed");
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[1][0].messages).toHaveLength(2);
  expect(create.mock.calls[1][0].messages[1].content).toContain(
    "Corrija a tentativa rejeitada",
  );
  expect(create.mock.calls[1][0].messages[1].content).not.toContain("OUTSIDE");
  expect((await getSession(id))!.tasks).toHaveLength(1);
});

it("stops after a rejected correction without saving a task or consuming further model calls", async () => {
  create.mockResolvedValue(
    response("criar_tarefa", {
      orderId: "UI-A",
      kind: "proposta_reenvio",
      title: text.title,
      justification: text.justification,
      evidenceIds: ["UI-A"],
    }),
  );
  const id = await session();
  const run = await investigate(
    { type: "order", target: "UI-A", requestId: randomUUID() },
    id,
    fixture,
    () => {},
  );
  expect(run.status).toBe("failed");
  expect(create).toHaveBeenCalledTimes(2);
  expect((await getSession(id))!.tasks).toHaveLength(0);
});

it("preserves consulted coverage on provider failure without manufacturing recurrence proposals", async () => {
  create.mockRejectedValue({
    status: 429,
    name: "APIError",
    error: { code: "rate_limit_exceeded", message: "private-provider-payload" },
  });
  const id = await session();
  const run = await investigate(
    { type: "recurrences", target: "base", requestId: randomUUID() },
    id,
    fixture,
    () => {},
  );
  expect(run.status).toBe("failed");
  expect(create).toHaveBeenCalledTimes(1);
  expect(run.consultedInsightIds!.length).toBeGreaterThan(0);
  expect(run.recurrenceReview).toBeUndefined();
  expect(run.failure).toEqual({
    status: 429,
    code: "rate_limit_exceeded",
    type: "APIError",
  });
  expect(JSON.stringify(run)).not.toContain("private-provider-payload");
  expect((await getSession(id))!.tasks).toHaveLength(0);
});

it("creates a process investigation with real samples and preserves full affected coverage", async () => {
  const pattern = insights(fixture).find((p) => p.scope === "process")!;
  create.mockImplementation(async (payload) => {
    const facts = input(payload).consultar_padroes;
    expect(facts).not.toHaveProperty("hypothesis");
    expect(facts).not.toHaveProperty("investigationQuestion");
    expect(facts.sample).toHaveLength(3);
    expect(facts.sample[0]).toHaveProperty("promisedAt");
    return response("criar_acao_processo", {
      insightId: pattern.id,
      ...text,
      evidenceIds: facts.evidenceIds.slice(0, 2),
    });
  });
  const id = await session();
  const run = await investigate(
    { type: "pattern", target: pattern.id, requestId: randomUUID() },
    id,
    fixture,
    () => {},
  );
  expect(run.status).toBe("completed");
  expect(create).toHaveBeenCalledTimes(1);
  expect((await getSession(id))!.tasks[0].affectedOrderIds).toEqual(
    pattern.evidenceIds,
  );
  const prior = (await getSession(id))!.tasks[0];
  const conclusion = {
    outcome: "descartada" as const,
    observations: "A conferência anterior descartou a divergência no romaneio.",
    nextStep: "Conferir a embalagem na próxima investigação.",
    evidenceIds: prior.evidenceIds,
  };
  await updateTask(id, prior.id, "concluida", undefined, conclusion);
  const renewed = await investigate(
    {
      type: "pattern",
      target: pattern.id,
      requestId: randomUUID(),
      renewFromTaskId: prior.id,
    },
    id,
    fixture,
    () => {},
  );
  expect(renewed.status).toBe("completed");
  expect(
    input(create.mock.calls[1][0]).consultar_padroes.investigacaoAnterior,
  ).toMatchObject(conclusion);
  expect(
    (await getSession(id))!.tasks.find((t) => t.id === renewed.taskIds[0])!
      .previousTaskId,
  ).toBe(prior.id);
});

it("preserves reopening reasons and rejected proposals from the current cycle", async () => {
  const id = await session();
  const at = "2026-10-01T12:00:00.000Z";
  const data = {
    ...fixture,
    orders: [
      {
        ...fixture.orders[0],
        caseHistory: [
          {
            id: randomUUID(),
            action: "reopen" as const,
            note: "O cliente informou que a divergência voltou a ocorrer.",
            at,
          },
        ],
      },
    ],
  };
  await upsertTask(id, {
    ...tasks[0],
    status: "rejeitada",
    createdAt: at,
    rejection: {
      at,
      note: "Conferir o cadastro atualizado antes de propor novamente.",
    },
  });
  create.mockImplementation(async (payload) => {
    const facts = input(payload).consultar_pedido;
    expect(facts.reabertura.motivo).toBe(data.orders[0].caseHistory[0].note);
    expect(facts.propostasRejeitadas[0].motivo).toContain(
      "cadastro atualizado",
    );
    return response("criar_tarefa", {
      orderId: "UI-A",
      kind: "revisao_cadastral",
      title: text.title,
      justification: text.justification,
      evidenceIds: ["UI-A"],
    });
  });
  const run = await investigate(
    { type: "order", target: "UI-A", requestId: randomUUID() },
    id,
    data,
    () => {},
  );
  expect(run.status).toBe("completed");
  expect(create).toHaveBeenCalledTimes(1);
  expect((await getSession(id))!.tasks).toHaveLength(2);
});

it("lets the model choose a representative case without resending consultation transcripts", async () => {
  const data = {
    ...fixture,
    orders: fixture.orders
      .slice(1)
      .map((order, i) => ({ ...order, shift: i % 2 ? "noite" : "manhã" })),
  };
  // Each half has too few cases for a shift signal; keep the full group above threshold.
  data.orders = data.orders.flatMap((order) => [
    order,
    { ...order, id: `${order.id}-COPY` },
  ]);
  const pattern = insights(data).find((p) => p.scope === "case")!;
  expect(pattern).toBeDefined();
  create.mockImplementation(async (payload) => {
    const facts = input(payload);
    expect(payload.messages).toHaveLength(2);
    if (!facts.consultar_pedido)
      return response("consultar_pedido", {
        orderId: facts.consultar_padroes.evidenceIds[0],
      });
    const order = facts.consultar_pedido.pedido;
    return response("criar_tarefa", {
      orderId: order.id,
      kind:
        order.tipo === "item_faltante"
          ? "revisao_separacao"
          : "investigacao_logistica",
      title: text.title,
      justification: text.justification,
      evidenceIds: [order.id],
    });
  });
  const id = await session();
  const run = await investigate(
    { type: "pattern", target: pattern.id, requestId: randomUUID() },
    id,
    data,
    () => {},
  );
  expect(run.status).toBe("completed");
  expect(create).toHaveBeenCalledTimes(2);
});

it.each([true, false])(
  "analyzes recurrences in one request, including an empty selection: %s",
  async (select) => {
    create.mockImplementation(async (payload) => {
      const facts = input(payload).consultar_recorrencias;
      const candidate = facts.candidates[0];
      for (const c of facts.candidates)
        for (const id of c.sample) expect(facts.orders[id].id).toBe(id);
      return response("registrar_analise_recorrencias", {
        reason:
          "Os agrupamentos foram comparados considerando associação, amostra e trabalho anterior.",
        proposals: select
          ? [
              {
                insightId: candidate.insightId,
                ...text,
                evidenceIds: candidate.sample.slice(0, 2),
              },
            ]
          : [],
      });
    });
    const id = await session();
    const run = await investigate(
      { type: "recurrences", target: "base", requestId: randomUUID() },
      id,
      fixture,
      () => {},
    );
    expect(run.status).toBe("completed");
    expect(create).toHaveBeenCalledTimes(1);
    expect(run.consultedInsightIds).toEqual(
      input(create.mock.calls[0][0]).consultar_recorrencias.candidates.map(
        (c: any) => c.insightId,
      ),
    );
    expect(run.taskIds).toHaveLength(select ? 1 : 0);
  },
);

it("deduplicates repeated sample facts without dropping candidates, metrics or prior conclusions", () => {
  const order = { id: "CASE", exception: "item_faltante", gift: true };
  const previous = {
    conclusion: {
      observations: "A equipe encontrou divergência na conferência.",
      outcome: "sustentada",
    },
  };
  const raw = {
    candidates: ["turno", "cd"].map((insightId) => ({
      insightId,
      count: 20,
      share: 0.8,
      previous,
      sample: [order],
    })),
  };
  const compact = compactConsultation("consultar_recorrencias", raw) as any;
  expect(Object.keys(compact.orders)).toEqual(["CASE"]);
  expect(compact.candidates).toHaveLength(2);
  expect(compact.candidates[1]).toEqual({
    ...raw.candidates[1],
    sample: ["CASE"],
  });
  expect({ ...compact.orderDefaults, ...compact.orders.CASE }).toEqual(order);
  expect(raw.candidates[0].sample[0]).toEqual(order);
});

it("keeps sixteen candidates and their evidence in a bounded workload, rotating coverage on reanalysis", async () => {
  expect(
    insights(recurrenceWorkload).filter((p) => p.scope === "process").length,
  ).toBeGreaterThan(16);
  create.mockImplementation(async () =>
    response("registrar_analise_recorrencias", {
      reason:
        "Nenhum novo achado foi selecionado neste recorte para a verificação da equipe.",
      proposals: [],
    }),
  );
  const id = await session();
  const first = await investigate(
    { type: "recurrences", target: "base", requestId: randomUUID() },
    id,
    recurrenceWorkload,
    () => {},
  );
  const second = await investigate(
    { type: "recurrences", target: "base", requestId: randomUUID() },
    id,
    recurrenceWorkload,
    () => {},
  );
  expect(first.status).toBe("completed");
  expect(second.status).toBe("completed");
  expect(first.consultedInsightIds).toHaveLength(16);
  expect(
    second.consultedInsightIds!.some(
      (id) => !first.consultedInsightIds!.includes(id),
    ),
  ).toBe(true);
  for (const [payload] of create.mock.calls) {
    expect(payload.messages).toHaveLength(2);
    expect(JSON.stringify(payload).length).toBeLessThan(19000);
    const facts = input(payload).consultar_recorrencias;
    for (const c of facts.candidates)
      for (const id of c.sample) {
        const sample = { ...facts.orderDefaults, ...facts.orders[id] };
        const original = recurrenceWorkload.orders.find((o) => o.id === id)!;
        for (const key of [
          "exception",
          "carrier",
          "state",
          "shift",
          "machine",
          "dc",
          "lot",
          "gift",
          "promisedAt",
          "deliveredAt",
        ] as const)
          expect(sample[key]).toEqual(original[key]);
      }
  }
});
