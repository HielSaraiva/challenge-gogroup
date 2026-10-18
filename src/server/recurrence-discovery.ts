import { z } from "zod";
import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { chooseRecurrenceCandidates } from "@/domain/recurrence-coverage";
import { insights } from "@/domain/analytics";
import { latestPatternTask } from "@/domain/pattern-lifecycle";
import { exceptionLabels, type Task } from "@/domain/types";
import { insightGroupLabel } from "@/lib/utils";
import { AppError, getSession } from "./store";
import { executeStrategicTool } from "./agent-actions";
import { requireQualitative } from "./agent-evidence";
import type { AgentContext } from "./agent";

const text = { type: "string" };
const qualitative = {
  type: "string",
  description:
    "Texto qualitativo em português, sem quantidades, valores, porcentagens ou datas. Os indicadores são anexados pelo servidor. Não afirme causa comprovada.",
};
const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
export const recurrenceTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "consultar_recorrencias",
      description:
        "Compara agrupamentos calculados da base de exceções, suas amostras e investigações anteriores. Obrigatório antes de registrar a seleção. Não há títulos, hipóteses ou perguntas prontas: crie sua análise a partir dos fatos.",
      parameters: object({}, []),
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_analise_recorrencias",
      description:
        "Registra a justificativa da seleção e até três investigações prioritárias. Compare os candidatos, evite grupos sobrepostos e considere as conclusões anteriores. Pode selecionar nenhum quando não houver novos achados suficientes, justificando a decisão. Não invente recorrências, causas ou evidências.",
      parameters: object(
        {
          reason: qualitative,
          proposals: {
            type: "array",
            maxItems: 3,
            items: object(
              {
                insightId: text,
                title: qualitative,
                justification: qualitative,
                nextStep: qualitative,
                evidenceIds: {
                  type: "array",
                  minItems: 2,
                  maxItems: 3,
                  items: text,
                },
              },
              [
                "insightId",
                "title",
                "justification",
                "nextStep",
                "evidenceIds",
              ],
            ),
          },
        },
        ["reason", "proposals"],
      ),
    },
  },
];
const selection = z
  .object({
    reason: z.string().trim().min(20).max(2000),
    proposals: z
      .array(
        z
          .object({
            insightId: z.string().min(1).max(200),
            title: z.string().trim().min(5).max(160),
            justification: z.string().trim().min(15).max(1500),
            nextStep: z.string().trim().min(15).max(1000),
            evidenceIds: z.array(z.string()).min(2).max(3),
          })
          .strict(),
      )
      .max(3),
  })
  .strict();

function sameCoverage(left: string[], right: string[]) {
  const a = new Set(left),
    b = new Set(right);
  const shared = [...a].filter((id) => b.has(id)).length;
  const total = a.size + b.size - shared;
  return total > 0 && shared / total >= 0.8;
}

export async function executeRecurrenceTool(
  name: string,
  raw: unknown,
  context: AgentContext,
) {
  if (context.mode !== "recurrences")
    throw new AppError("Análise fora do escopo.");
  if (name === "consultar_recorrencias") {
    z.object({}).strict().parse(raw);
    const state = await getSession(context.sessionId);
    if (!state) throw new AppError("Sessão expirada.", 401);
    const candidates = chooseRecurrenceCandidates(
      insights(context.data).filter((item) => item.scope === "process"),
      state.investigations,
    );
    context.recurrenceCandidates = candidates.map((item) => ({
      insightId: item.id,
      evidenceIds: item.evidenceIds.slice(0, 3),
    }));
    context.consultedInsights = new Set(candidates.map((item) => item.id));
    const orders = new Map(
      context.data.orders.map((order) => [order.id, order]),
    );
    return {
      warning:
        "São agrupamentos de pedidos com exceção, não todas as vendas. Associação não prova causa nem taxa real de falha. Compare a força do sinal, a amostra, sobreposição de pedidos e o trabalho já registrado. Não recrie investigações existentes; só proponha achados que mereçam verificação adicional.",
      candidates: candidates.map((item) => {
        const previous = latestPatternTask(state.tasks, item.id);
        return {
          insightId: item.id,
          problem:
            exceptionLabels[item.exception] || "Divergência no prazo prometido",
          dimension: item.dimension,
          group: insightGroupLabel(item.group),
          count: item.count,
          eligible: item.total,
          share: item.share,
          baselineShare: item.baselineShare,
          relativeAssociation: item.enrichment,
          sample: item.evidenceIds.slice(0, 3).map((id) => {
            const order = orders.get(id)!;
            return {
              id,
              exception: order.exception,
              brand: order.brand,
              carrier: order.carrier,
              state: order.state,
              machine: order.machine,
              shift: order.shift,
              dc: order.dc,
              lot: order.lot,
              gift: order.gift,
              promisedAt: order.promisedAt,
              deliveredAt: order.deliveredAt,
              resolved: Boolean(order.resolution),
            };
          }),
          previous: previous
            ? {
                title: previous.title,
                hypothesis: previous.justification.slice(0, 400),
                status: previous.status,
                progress:
                  !previous.conclusion && previous.processProgress
                    ? {
                        observations:
                          previous.processProgress.observations.slice(0, 400),
                        nextStep: previous.processProgress.nextStep.slice(
                          0,
                          400,
                        ),
                        checkedOrders: previous.processProgress.evidenceIds,
                      }
                    : undefined,
                conclusion: previous.conclusion
                  ? {
                      outcome: previous.conclusion.outcome,
                      observations: previous.conclusion.observations.slice(
                        0,
                        400,
                      ),
                      nextStep: previous.conclusion.nextStep.slice(0, 400),
                    }
                  : undefined,
              }
            : null,
        };
      }),
    };
  }
  if (
    name !== "registrar_analise_recorrencias" ||
    !context.recurrenceCandidates
  )
    throw new AppError(
      "Consulte os agrupamentos antes de registrar a análise.",
    );
  if (context.recurrenceReview)
    throw new AppError("Esta análise já foi registrada.");
  const args = selection.parse(raw);
  requireQualitative(args.reason, context.data);
  const seen = new Set<string>();
  const calculated = insights(context.data);
  // Validate the full selection before any task is saved.
  for (const proposal of args.proposals) {
    const candidate = context.recurrenceCandidates.find(
      (item) => item.insightId === proposal.insightId,
    );
    if (!candidate || seen.has(proposal.insightId))
      throw new AppError(
        "Selecione sinais distintos e consultados nesta análise.",
      );
    const full = calculated.find((item) => item.id === proposal.insightId)!;
    if (
      [...seen].some((id) => {
        const other = calculated.find((item) => item.id === id)!;
        return (
          other.exception === full.exception &&
          sameCoverage(other.evidenceIds, full.evidenceIds)
        );
      })
    )
      throw new AppError(
        "Os achados selecionados cobrem essencialmente os mesmos pedidos. Escolha uma investigação por conjunto.",
      );
    seen.add(proposal.insightId);
    if (
      new Set(proposal.evidenceIds).size < 2 ||
      proposal.evidenceIds.some((id) => !candidate.evidenceIds.includes(id))
    )
      throw new AppError(
        "Use ao menos dois pedidos distintos da amostra do sinal selecionado.",
      );
    for (const value of [
      proposal.title,
      proposal.justification,
      proposal.nextStep,
    ])
      requireQualitative(value, context.data);
  }
  const taskIds: string[] = [];
  const reusedTaskIds: string[] = [];
  for (const proposal of args.proposals) {
    const currentTasks = (await getSession(context.sessionId))?.tasks || [];
    const full = calculated.find((item) => item.id === proposal.insightId)!;
    const previous =
      latestPatternTask(currentTasks, proposal.insightId) ||
      currentTasks.find((task) => {
        if (
          task.scope !== "process" ||
          !task.insightId ||
          latestPatternTask(currentTasks, task.insightId)?.id !== task.id
        )
          return false;
        const prior = calculated.find((item) => item.id === task.insightId);
        return (
          prior?.exception === full.exception &&
          sameCoverage(task.affectedOrderIds || [], full.evidenceIds)
        );
      });
    const task =
      previous ||
      ((await executeStrategicTool("criar_acao_processo", proposal, {
        ...context,
        mode: "pattern",
        patternId: proposal.insightId,
        evidence: new Set(
          context.recurrenceCandidates.find(
            (item) => item.insightId === proposal.insightId,
          )!.evidenceIds,
        ),
        renewFromTaskId: undefined,
      })) as Task);
    if (previous) reusedTaskIds.push(task.id);
    taskIds.push(task.id);
    context.recurrenceTaskIds = [
      ...new Set([...(context.recurrenceTaskIds || []), task.id]),
    ];
  }
  context.recurrenceReview = {
    reason: args.reason,
    selectedInsightIds: [...seen],
    reusedTaskIds,
  };
  return { ...context.recurrenceReview, taskIds };
}
