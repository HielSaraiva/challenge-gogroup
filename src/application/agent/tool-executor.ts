import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { insights, rankOrders } from "@/domain/analytics";
import { addBusinessDays } from "@/domain/calendar";
import { currentCaseTasks, latestReopen } from "@/domain/case-cycle";
import {
  REFERENCE_DATE,
  TASK_KINDS,
  exceptionLabels,
  type RankedOrder,
} from "@/domain/types";
import { allowedTaskKinds, taskAreas } from "@/domain/task-policy";
import { statusLabel } from "@/domain/labels";
import { AppError } from "@/application/errors";
import {
  executeRecurrenceTool,
  recurrenceTools,
} from "@/application/agent/recurrence-discovery";
import {
  executeStrategicTool,
  strategicTools,
} from "@/application/agent/agent-actions";
import { requireQualitative } from "@/application/agent/agent-evidence";
import type { AgentContext } from "@/application/agent/contracts";

const orderArgs = z.object({ orderId: z.string().min(1).max(40) }).strict();
const patternArgs = z
  .object({ insightId: z.string().min(1).max(200) })
  .strict();
const simulationArgs = orderArgs
  .extend({ action: z.enum(["reenvio", "reembolso"]) })
  .strict();
const taskArgs = z
  .object({
    orderId: z.string().min(1),
    kind: z.enum(TASK_KINDS),
    title: z.string().min(5).max(160),
    justification: z.string().min(15).max(1500),
    evidenceIds: z.array(z.string()).min(1).max(20),
  })
  .strict();
export async function executeTool(
  name: string,
  raw: unknown,
  context: AgentContext,
): Promise<unknown> {
  const { upsertTask, getSession } = context.repository;
  if (context.mode === "recurrences")
    return executeRecurrenceTool(name, raw, context);
  if (recurrenceTools.some((tool) => tool.function?.name === name))
    throw new AppError("Ferramenta fora do escopo.");
  if (strategicTools.some((tool) => tool.function?.name === name))
    return executeStrategicTool(name, raw, context);
  const orders = rankOrders(context.data);
  const findOrder = (id: string, allowResolved = false): RankedOrder => {
    if (!context.allowedIds.has(id))
      throw new AppError("Pedido fora do escopo desta investigação.");
    const order = orders.find((o) => o.id === id);
    if (!order) throw new AppError("Pedido inexistente.", 404);
    if (order.resolution && !allowResolved)
      throw new AppError(
        "Esta exceção foi encerrada na sessão. Reabra antes de investigar.",
        409,
      );
    return order;
  };
  if (name === "consultar_pedido") {
    const { orderId } = orderArgs.parse(raw);
    const o = findOrder(orderId, context.processInvestigation === true);
    context.consulted.add(orderId);
    context.evidence.add(orderId);
    const c = context.data.customers.find((c) => c.id === o.customerId)!;
    return {
      pedido: {
        id: o.id,
        marca: o.brand,
        produto: o.product,
        valor: o.value,
        tipo: o.exception,
        status: o.status,
        statusOriginais: o.sourceStatuses,
        prometido: o.promisedAt,
        entregue: o.deliveredAt,
        abertura: o.openedAt,
        transportadora: o.carrier,
        uf: o.state,
        maquina: o.machine,
        turno: o.shift,
        cd: o.dc,
        lote: o.lot,
        brinde: o.gift,
      },
      cliente: { pedidos: c.orders, receita: c.revenue, contatos: c.contacts },
      indicadores: o.priority,
      problemasDados: o.issues,
      propostasRejeitadas: currentCaseTasks(
        o,
        (await getSession(context.sessionId))?.tasks || [],
      )
        .filter((task) => task.status === "rejeitada")
        .map((task) => ({
          tipo: task.kind,
          motivo:
            task.rejection?.note || "Motivo não informado em registro antigo",
        })),
      reabertura: latestReopen(o.caseHistory)
        ? {
            em: latestReopen(o.caseHistory)!.at,
            motivo: latestReopen(o.caseHistory)!.note,
            orientacao:
              "Nova etapa de atendimento. Registre um novo encaminhamento; a execução anterior não comprova a resolução atual.",
          }
        : undefined,
      acoesAdmitidas:
        o.status === "status_divergente"
          ? ["revisao_status"]
          : allowedTaskKinds[o.exception],
      evidenceIdsParaCriarTarefa: [o.id],
      instrucaoEvidencia:
        "Use o ID exato do pedido em evidenceIds. Não use nomes de campos, códigos de problema nem valores como evidências.",
      referencia: REFERENCE_DATE,
    };
  }
  if (name === "consultar_padroes") {
    const { insightId } = patternArgs.parse(raw);
    if (context.patternId && context.patternId !== insightId)
      throw new AppError("Sinal fora do escopo desta investigação.");
    const insight = insights(context.data).find((i) => i.id === insightId);
    if (
      !insight ||
      !insight.evidenceIds.some((id) => context.allowedIds.has(id))
    )
      throw new AppError("Sinal fora do escopo.");
    const evidenceIds = insight.evidenceIds
      .filter((id) => context.allowedIds.has(id))
      .slice(0, 20);
    for (const id of evidenceIds) context.evidence.add(id);
    context.patternConsulted = true;
    context.consultedInsights ??= new Set();
    context.consultedInsights.add(insightId);
    return {
      ...insight,
      ...(context.renewFromTaskId
        ? {
            investigacaoAnterior: (
              await getSession(context.sessionId)
            )?.tasks.find((task) => task.id === context.renewFromTaskId)
              ?.conclusion,
          }
        : {}),
      evidenceIds,
      warning:
        "Amostra somente de exceções; não há denominador de todas as vendas. Não afirmar causalidade.",
    };
  }
  if (name === "simular_tratativa") {
    const { orderId, action } = simulationArgs.parse(raw);
    const order = findOrder(orderId);
    if (!context.consulted.has(orderId))
      throw new AppError("Consulte o pedido primeiro.");
    const kind =
      action === "reenvio" ? "proposta_reenvio" : "proposta_reembolso";
    if (!(allowedTaskKinds[order.exception] || []).includes(kind))
      throw new AppError("Alternativa não admitida para esta exceção.");
    context.simulated.add(`${orderId}:${action}`);
    return {
      orderId,
      action,
      custoEstimado:
        action === "reenvio" ? order.priority.resendCost : order.value,
      executado: false,
      aviso:
        "Estimativa, sujeita a aprovação e verificação de estoque/pagamento. Reenvio integral é proxy para item faltante; não há preço por item.",
    };
  }
  if (name === "criar_tarefa") {
    const args = taskArgs.parse(raw);
    requireQualitative(args.justification, context.data);
    const order = findOrder(args.orderId);
    if (context.requiresPattern && !context.patternConsulted)
      throw new AppError(
        "Consulte o sinal antes de registrar o encaminhamento.",
      );
    if (!context.consulted.has(order.id))
      throw new AppError(
        "É obrigatório consultar o pedido antes de criar tarefa.",
      );
    if (
      !args.evidenceIds.includes(order.id) ||
      args.evidenceIds.some((id) => !context.evidence.has(id))
    )
      throw new AppError(
        "As evidências precisam incluir o pedido e ter sido consultadas nesta execução.",
      );
    if (order.status === "status_divergente" && args.kind !== "revisao_status")
      throw new AppError(
        "Revise o conflito de status antes de propor outra ação.",
      );
    if (
      args.kind !== "revisao_status" &&
      !(allowedTaskKinds[order.exception] || []).includes(args.kind)
    )
      throw new AppError("Tarefa incompatível com a exceção.");
    if (args.kind === "revisao_status" && order.status !== "status_divergente")
      throw new AppError("Pedido não possui conflito de status.");
    const financial =
      args.kind === "proposta_reenvio" || args.kind === "proposta_reembolso";
    if (
      financial &&
      !context.simulated.has(
        `${order.id}:${args.kind === "proposta_reenvio" ? "reenvio" : "reembolso"}`,
      )
    )
      throw new AppError("Simule o custo antes de criar a proposta.");
    const now = new Date().toISOString();
    const reopenId = [...(order.caseHistory || [])]
      .reverse()
      .find((event) => event.action === "reopen")?.id;
    const state = await getSession(context.sessionId);
    const rejected = currentCaseTasks(order, state?.tasks || [])
      .filter((task) => task.kind === args.kind && task.status === "rejeitada")
      .at(-1);
    const key = createHash("sha256")
      .update(
        `${order.id}:${args.kind}${reopenId ? `:${reopenId}` : ""}${rejected ? `:retry:${rejected.id}` : ""}`,
      )
      .digest("hex");
    const facts = [
      `Exceção registrada: ${exceptionLabels[order.exception]}.`,
      `Status: ${statusLabel(order.status)}.`,
      `Idade da exceção: ${order.priority.age} dias úteis; atraso até ${order.deliveredAt ? "a entrega" : "a referência"}: ${order.priority.delay} dias úteis.`,
      `Valor do pedido: R$ ${order.value}; reenvio estimado: R$ ${order.priority.resendCost}; exposição elegível a cancelamento: R$ ${order.priority.cancellationRisk}.`,
    ];
    return upsertTask(context.sessionId, {
      ...args,
      justification: `Hipótese do agente: ${args.justification}`,
      facts,
      id: randomUUID(),
      investigationId: context.runId,
      area: taskAreas[args.kind],
      dueAt: addBusinessDays(REFERENCE_DATE, 1),
      status: financial ? "pendente_aprovacao" : "aberta",
      createdAt: now,
      updatedAt: now,
      idempotencyKey: key,
    });
  }
  throw new AppError("Ferramenta desconhecida.");
}
