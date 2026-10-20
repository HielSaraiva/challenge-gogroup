import { beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { data as fixture } from "./browser/fixtures";
import { createSession, getSession } from "@/server/store";
import { investigate } from "@/server/agent";
import { workstreams } from "@/domain/operations";
import { queue } from "@/domain/analytics";
import { STRATEGIES } from "@/domain/types";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));
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
    id: `DAY-${i}`,
    exception: exceptions[i % exceptions.length],
    status: i < 10 ? "status_divergente" : "aberta",
    sourceStatuses: i < 10 ? ["aberta", "em_analise"] : ["aberta"],
  })),
  sourceRows: 150,
};
function result(payload: any, wrong = false) {
  const input = JSON.parse(payload.messages[1].content.split("\nCorrija")[0]);
  return {
    usage: { prompt_tokens: 1200, completion_tokens: 900, total_tokens: 2100 },
    choices: [
      {
        message: {
          tool_calls: [
            {
              id: randomUUID(),
              type: "function",
              function: {
                name: "registrar_plano_dia",
                arguments: JSON.stringify({
                  strategyReason:
                    "A estratégia escolhida equilibra a espera, a exposição e o relacionamento conforme os indicadores comparados.",
                  briefing:
                    "Conferir evidências e iniciar pelos casos sugeridos em cada área.",
                  priorityAreas: input.areas
                    .slice(0, 3)
                    .map((a: any) => a.area),
                  instructions: input.areas.map((a: any) => ({
                    area: a.area,
                    firstOrderId: wrong ? "OUTSIDE" : a.sample[0].id,
                    justification:
                      "O caso pertence à amostra prioritária desta área e merece conferência.",
                    nextStep:
                      "Conferir os registros operacionais antes de encaminhar a tratativa.",
                  })),
                }),
              },
            },
          ],
        },
      },
    ],
  };
}
beforeEach(() => {
  create.mockReset();
  process.env.GROQ_API_KEY = "test-only";
});
it("prepares all eight areas in one bounded request and preserves the requested selection", async () => {
  create.mockImplementation(async (payload) => result(payload));
  const id = randomUUID();
  await createSession(id);
  const run = await investigate(
    {
      type: "daily",
      target: "day",
      requestId: randomUUID(),
      strategy: "urgencia",
    },
    id,
    data,
    () => {},
  );
  expect(run.status).toBe("completed");
  expect(create).toHaveBeenCalledTimes(1);
  const payload = create.mock.calls[0][0];
  expect(payload.max_completion_tokens).toBe(1800);
  expect(payload.messages).toHaveLength(2);
  expect(JSON.stringify(payload).length).toBeLessThan(16000);
  expect(payload.messages[1].content).not.toContain("reasons");
  const plan = (await getSession(id))!.plans![0];
  expect(plan.strategy).toBe("urgencia");
  expect(plan.selectedOrderIds).toEqual(
    queue(data, STRATEGIES.urgencia.weights).orders.map((o) => o.id),
  );
  expect(plan.workstreams).toHaveLength(8);
  expect(
    plan.workstreams.every((s) =>
      workstreams(data, STRATEGIES.urgencia.weights)
        .find((w) => w.area === s.area)!
        .sample.some((o) => o.id === s.agentDecision!.firstOrderId),
    ),
  ).toBe(true);
  expect(run.tokenUsage).toEqual({
    requests: 1,
    input: 1200,
    output: 900,
    total: 2100,
  });
  expect(
    run.events.filter((e) => e.state === "ok").map((e) => e.tool),
  ).toContain("consultar_fila");
});
it("corrects only once with a compact validation message, without saving an invalid plan", async () => {
  create
    .mockImplementationOnce(async (payload) => result(payload, true))
    .mockImplementationOnce(async (payload) => result(payload));
  const id = randomUUID();
  await createSession(id);
  const run = await investigate(
    { type: "daily", target: "day", requestId: randomUUID() },
    id,
    data,
    () => {},
  );
  expect(run.status).toBe("completed");
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[1][0].messages).toHaveLength(2);
  expect(create.mock.calls[1][0].messages[1].content).toContain(
    "Corrija a tentativa rejeitada",
  );
  expect((await getSession(id))!.plans).toHaveLength(1);
});
