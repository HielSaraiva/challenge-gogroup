import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { queue, insights } from "@/domain/analytics";
import { workstreams } from "@/domain/operations";
import { addBusinessDays } from "@/domain/calendar";
import {
  DEFAULT_WEIGHTS,
  REFERENCE_DATE,
  type DailyPlan,
} from "@/domain/types";
import { AppError, upsertDailyPlan, upsertTask } from "./store";
import type { AgentContext } from "./agent";
import { requireQualitative } from "./agent-evidence";
const text = { type: "string" };
const dailyGuidance: Record<string, string> = {
  Logística:
    "Conferir rastreio, ocorrências e comprovantes dos pedidos; registrar investigação ou proposta sujeita a aprovação.",
  Financeiro:
    "Conferir conciliação e comprovantes de pagamento antes de encaminhar a pendência. Não há dados de crédito ou negociação.",
  Estoque:
    "Verificar disponibilidade dos itens dos pedidos e registrar alternativa para aprovação após a confirmação de estoque.",
  Qualidade:
    "Inspecionar evidências de embalagem e lote dos casos selecionados; registrar necessidade de investigação de processo separadamente.",
  Atendimento:
    "Conferir os dados disponíveis e encaminhar confirmação de endereço ao operador responsável.",
  Produção:
    "Conferir arte, especificação e registro de personalização de cada caso antes de propor reprodução.",
  "Operações / CD":
    "Conferir romaneio, separação e presença de brinde dos pedidos com item faltante.",
  "Revisão de dados":
    "Comparar os status conflitantes e registrar revisão explícita antes de outra transição do caso.",
};
const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
export const strategicTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "consultar_fila",
      description:
        "Consulta a seleção do dia calculada, capacidade restante, comparação FIFO, motivos e frentes de trabalho. Obrigatório antes de registrar o plano.",
      parameters: object({}, []),
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_plano_dia",
      description:
        "Registra encaminhamentos para a seleção já calculada pelo sistema. Para CADA área escolha firstOrderId entre os IDs da amostra consultada, justifique a escolha e indique o próximo passo. Destaque até três áreas. Textos qualitativos; IDs somente no campo firstOrderId. Não altere a seleção nem declare casos investigados em profundidade.",
      parameters: object(
        {
          briefing: text,
          priorityAreas: {
            type: "array",
            items: text,
            minItems: 1,
            maxItems: 3,
          },
          instructions: {
            type: "array",
            items: object(
              {
                area: text,
                nextStep: text,
                firstOrderId: text,
                justification: text,
              },
              ["area", "nextStep", "firstOrderId", "justification"],
            ),
            minItems: 1,
            maxItems: 10,
          },
        },
        ["briefing", "priorityAreas", "instructions"],
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "criar_acao_processo",
      description:
        "Registra investigação de melhoria do processo inteiro a partir de um padrão consultado. Não resolve os pedidos, não prova causa e não executa alterações externas. Use ao menos dois IDs exatos retornados como evidência.",
      parameters: object(
        {
          insightId: text,
          title: text,
          justification: text,
          nextStep: text,
          evidenceIds: {
            type: "array",
            items: text,
            minItems: 2,
            maxItems: 20,
          },
        },
        ["insightId", "title", "justification", "nextStep", "evidenceIds"],
      ),
    },
  },
];
const planArgs = z
  .object({
    briefing: z.string().min(20).max(2000),
    priorityAreas: z.array(z.string()).min(1).max(3),
    instructions: z
      .array(
        z
          .object({
            area: z.string(),
            nextStep: z.string().min(15).max(1000),
            firstOrderId: z.string().min(1).max(50),
            justification: z.string().min(15).max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();
const processArgs = z
  .object({
    insightId: z.string().min(1).max(200),
    title: z.string().min(5).max(160),
    justification: z.string().min(15).max(1500),
    nextStep: z.string().min(15).max(1000),
    evidenceIds: z.array(z.string()).min(2).max(20),
  })
  .strict();
export async function executeStrategicTool(
  name: string,
  raw: unknown,
  context: AgentContext,
): Promise<unknown> {
  const weights = context.weights || DEFAULT_WEIGHTS;
  if (name === "consultar_fila") {
    if (context.mode !== "daily")
      throw new AppError("Consulta de fila fora do escopo desta investigação.");
    z.object({}).strict().parse(raw);
    const selection = queue(context.data, weights);
    if (!selection.orders.length)
      throw new AppError(
        "Não há vagas disponíveis ou pedidos pendentes para planejar.",
        409,
      );
    context.queueConsulted = true;
    for (const stream of workstreams(context.data, weights)) {
      for (const order of stream.sample) context.evidence.add(order.id);
    }
    return {
      referencia: REFERENCE_DATE,
      capacidade: selection.capacity,
      utilizada: selection.usedCapacity,
      disponivel: selection.availableCapacity,
      selecionados: selection.orders.length,
      reservaAntigos: selection.oldestReserved,
      politica:
        "Reserva de 20% das vagas restantes para os casos mais antigos; demais vagas por pontuação explicável. Não confundir valor coberto com dinheiro recuperado.",
      comparacao: { priorizada: selection.prioritized, fifo: selection.fifo },
      frentes: workstreams(context.data, weights).map((stream) => ({
        area: stream.area,
        quantidade: stream.orderIds.length,
        valor: stream.value,
        exposicao: stream.risk,
        amostra: stream.sample,
        roteiroOperacional: dailyGuidance[stream.area],
      })),
      aviso:
        "Escreva próximos passos concretos para triagem destes pedidos, seguindo o roteiro de cada área. Mudanças de rota, contrato, política de crédito, máquinas ou processo exigem investigação separada e não cabem como execução da agenda individual. O plano não executa tratativas nem atesta resultado financeiro.",
    };
  }
  if (name === "registrar_plano_dia") {
    if (context.mode !== "daily" || !context.queueConsulted)
      throw new AppError("Consulte a fila antes de registrar o plano.");
    const args = planArgs.parse(raw);
    requireQualitative(args.briefing, context.data);
    for (const instruction of args.instructions) {
      requireQualitative(instruction.nextStep, context.data);
      requireQualitative(instruction.justification, context.data);
    }
    const selection = queue(context.data, weights);
    const streams = workstreams(context.data, weights);
    const expected = new Set(streams.map((stream) => stream.area));
    const instructions = new Map(
      args.instructions.map((instruction) => [instruction.area, instruction]),
    );
    if (
      instructions.size !== args.instructions.length ||
      instructions.size !== expected.size ||
      [...expected].some((area) => !instructions.has(area)) ||
      args.priorityAreas.some((area) => !expected.has(area)) ||
      new Set(args.priorityAreas).size !== args.priorityAreas.length
    )
      throw new AppError(
        `Use exatamente uma orientação para cada área: ${[...expected].join(", ")}. Destaque apenas áreas dessa lista.`,
      );
    for (const stream of streams) {
      const instruction = instructions.get(stream.area)!;
      if (
        !context.evidence.has(instruction.firstOrderId) ||
        !stream.sample.some((order) => order.id === instruction.firstOrderId)
      ) {
        throw new AppError(
          `O primeiro pedido de ${stream.area} deve pertencer à amostra consultada dessa área: ${stream.sample.map((order) => order.id).join(", ")}.`,
        );
      }
    }
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          policy: "evidence-led-plan-v2",
          reference: REFERENCE_DATE,
          selected: selection.orders.map((order) => [order.id, order.status]),
          used: selection.usedCapacity,
          weights,
        }),
      )
      .digest("hex");
    const plan: DailyPlan = {
      id: randomUUID(),
      idempotencyKey: fingerprint,
      investigationId: context.runId,
      reference: REFERENCE_DATE,
      createdAt: new Date().toISOString(),
      selectedOrderIds: selection.orders.map((order) => order.id),
      capacity: selection.capacity,
      usedCapacity: selection.usedCapacity,
      weights,
      priorityAreas: args.priorityAreas,
      briefing: args.briefing,
      workstreams: streams.map((stream) => ({
        area: stream.area,
        orderIds: stream.orderIds,
        value: stream.value,
        risk: stream.risk,
        nextStep: instructions.get(stream.area)!.nextStep,
        agentDecision: {
          firstOrderId: instructions.get(stream.area)!.firstOrderId,
          justification: instructions.get(stream.area)!.justification,
        },
      })),
      fingerprint,
    };
    return upsertDailyPlan(context.sessionId, plan);
  }
  if (name === "criar_acao_processo") {
    const args = processArgs.parse(raw);
    requireQualitative(args.justification, context.data);
    requireQualitative(args.nextStep, context.data);
    if (
      context.mode !== "pattern" ||
      !context.consultedInsights?.has(args.insightId) ||
      (context.patternId && context.patternId !== args.insightId)
    )
      throw new AppError(
        "Consulte o padrão correto antes de criar a ação de processo.",
      );
    const insight = insights(context.data).find(
      (item) => item.id === args.insightId,
    );
    if (!insight || insight.scope !== "process")
      throw new AppError(
        "Este sinal ainda não sustenta uma ação de processo. Investigue um caso e amplie a amostra.",
      );
    if (
      new Set(args.evidenceIds).size < 2 ||
      args.evidenceIds.some(
        (id) => !context.evidence.has(id) || !insight.evidenceIds.includes(id),
      )
    )
      throw new AppError(
        "Use ao menos dois pedidos distintos da amostra consultada como evidências.",
      );
    const now = new Date().toISOString();
    const key = createHash("sha256")
      .update(`process:${insight.id}`)
      .digest("hex");
    const area =
      (
        {
          machine: "Produção",
          machine_shift_dc: "Produção",
          dc: "Operações / CD",
          shift: "Operações / CD",
          lot: "Qualidade",
          gift: "Operações / CD",
          carrier: "Logística",
          carrier_state: "Logística",
          state: "Logística",
          promise_rule: "Tecnologia / Operações",
        } as Record<string, string>
      )[insight.dimension] || "Excelência operacional";
    return upsertTask(context.sessionId, {
      id: randomUUID(),
      investigationId: context.runId,
      orderId: args.evidenceIds[0],
      kind: "melhoria_processo",
      scope: "process",
      insightId: insight.id,
      affectedOrderIds: insight.evidenceIds,
      title: args.title,
      justification: `Hipótese do agente: ${args.justification}`,
      nextStep: args.nextStep,
      evidenceIds: args.evidenceIds,
      area,
      dueAt: addBusinessDays(REFERENCE_DATE, 2),
      status: "aberta",
      createdAt: now,
      updatedAt: now,
      idempotencyKey: key,
      facts: [
        `${insight.count} de ${insight.total} registros elegíveis desta análise pertencem ao grupo ${insight.group}.`,
        insight.dimension === "promise_rule"
          ? "Divergência verificada entre promessa original e a regra de separação + SLA."
          : `Participação na exceção: ${(insight.share * 100).toFixed(1)}%; na base de exceções com a dimensão disponível: ${(insight.baselineShare * 100).toFixed(1)}%; associação relativa: ${insight.enrichment.toFixed(2)}x.`,
        `Ação de processo: investigar o conjunto. Não encerra ${insight.evidenceIds.length} pedidos nem comprova causa.`,
        "Esforço de investigação de processo deve ser dimensionado antes de incluí-lo na agenda da equipe.",
      ],
    });
  }
  throw new AppError("Ferramenta estratégica desconhecida.");
}
