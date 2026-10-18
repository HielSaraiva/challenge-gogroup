import { currentCaseTasks } from "./case-cycle";
import { closureRecords } from "./financial-records";
import { z } from "zod";
import Decimal from "decimal.js";
import type { CaseRecord, Dataset, Order, SessionState, Task } from "./types";
const amount = z.string().regex(/^\d{1,7}(\.\d{1,2})?$/);
export const outcomeSchema = z
  .object({
    type: z.enum([
      "endereco_corrigido",
      "entrega_confirmada",
      "item_reenviado",
      "pagamento_regularizado",
      "estoque_regularizado",
      "reembolso_registrado",
    ]),
    evidence: z.string().trim().min(15).max(1500),
    evidenceTaskId: z.string().min(1).max(100).optional(),
    executionTaskId: z.string().min(1).max(100).optional(),
    receiptConfirmed: z.boolean().optional(),
    refund: amount.optional(),
    cost: z
      .object({ amount, kind: z.enum(["estimated", "declared"]) })
      .strict()
      .optional(),
  })
  .strict();
export const outcomeLabels = {
  endereco_corrigido: "Endereço corrigido",
  entrega_confirmada: "Entrega confirmada",
  item_reenviado: "Item reenviado ou reproduzido",
  pagamento_regularizado: "Pagamento regularizado",
  estoque_regularizado: "Disponibilidade regularizada",
  reembolso_registrado: "Reembolso registrado",
};
export function allowedOutcomes(
  exception: string,
): (keyof typeof outcomeLabels)[] {
  if (exception === "endereco_divergente") return ["endereco_corrigido"];
  if (exception === "pagamento_pendente")
    return ["pagamento_regularizado", "reembolso_registrado"];
  if (exception === "ruptura_pos_venda")
    return ["estoque_regularizado", "item_reenviado", "reembolso_registrado"];
  if (
    [
      "item_faltante",
      "falha_personalizacao",
      "vazamento_produto",
      "avaria_transporte",
    ].includes(exception)
  )
    return ["item_reenviado", "reembolso_registrado"];
  return ["entrega_confirmada", "item_reenviado", "reembolso_registrado"];
}
export const caseActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("review_status"),
      orderId: z.string().min(1).max(50),
      status: z.string().min(1).max(50),
      note: z.string().trim().min(10).max(1200),
    })
    .strict(),
  z
    .object({
      action: z.literal("resolve"),
      orderId: z.string().min(1).max(50),
      note: z.string().trim().min(10).max(1200),
      outcome: outcomeSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("reopen"),
      orderId: z.string().min(1).max(50),
      note: z.string().trim().min(10).max(1200),
    })
    .strict(),
]);
export function sessionDataset(data: Dataset, state: SessionState): Dataset {
  return {
    ...data,
    orders: data.orders.map((order) => {
      const record = state.cases?.[order.id];
      if (!record) return order;
      return {
        ...order,
        status: record.resolution
          ? "resolvida"
          : record.statusReview?.status || order.status,
        statusReview: record.statusReview,
        resolution: record.resolution,
        caseHistory: record.history,
      };
    }),
  };
}
export function transitionCase(
  order: Order,
  previous: CaseRecord | undefined,
  tasks: Task[],
  action: z.infer<typeof caseActionSchema>,
  eventId: string,
  now: string,
): CaseRecord {
  const next: CaseRecord = {
    orderId: order.id,
    version: (previous?.version || 0) + 1,
    history: [...(previous?.history || [])],
    statusReview: previous?.statusReview,
    resolution: previous?.resolution,
  };
  if (action.action === "review_status") {
    if (order.sourceStatuses.length < 2)
      throw new Error("Este pedido não possui conflito de status.");
    if (next.resolution)
      throw new Error("Reabra a exceção antes de revisar o status.");
    if (!order.sourceStatuses.includes(action.status))
      throw new Error("Escolha um dos status presentes na origem.");
    next.statusReview = {
      status: action.status,
      note: action.note,
      reviewedAt: now,
    };
  } else if (action.action === "resolve") {
    if (next.resolution) throw new Error("Esta exceção já foi encerrada.");
    if (order.sourceStatuses.length > 1 && !next.statusReview)
      throw new Error(
        "Revise o conflito de status antes de encerrar a exceção.",
      );
    const related = currentCaseTasks(
      { ...order, caseHistory: previous?.history },
      tasks,
    );
    const lastReopen = [...(previous?.history || [])]
      .reverse()
      .find((event) => event.action === "reopen");
    if (
      !related.some(
        (t) =>
          t.status === "concluida" &&
          t.kind !== "revisao_status" &&
          t.execution &&
          (!lastReopen ||
            Boolean(t.execution.at && t.execution.at >= lastReopen.at)),
      )
    )
      throw new Error(
        "Conclua a execução de uma tarefa antes de encerrar a exceção.",
      );
    if (
      related.some((t) =>
        ["aberta", "pendente_aprovacao", "aprovada"].includes(t.status),
      )
    )
      throw new Error(
        "Existem tarefas ou propostas pendentes para este pedido.",
      );
    const outcome = outcomeSchema.parse(action.outcome);
    // Older callers omit the link; resolve it once and persist it for new records.
    const executionId = outcome.executionTaskId || outcome.evidenceTaskId;
    const source = executionId
      ? related.find((task) => task.id === executionId)
      : [...related]
          .filter(
            (task) =>
              task.status === "concluida" &&
              task.kind !== "revisao_status" &&
              task.execution,
          )
          .sort((a, b) =>
            (b.execution?.at || "").localeCompare(a.execution?.at || ""),
          )[0];
    if (
      !source?.execution ||
      source.status !== "concluida" ||
      source.kind === "revisao_status" ||
      (lastReopen &&
        (!source.execution.at || source.execution.at < lastReopen.at))
    )
      throw new Error(
        "Vincule uma execução válida da etapa atual deste pedido.",
      );
    if (
      source.kind === "proposta_reembolso" &&
      outcome.type !== "reembolso_registrado"
    )
      throw new Error(
        "A execução de um reembolso deve ser encerrada com o resultado de reembolso registrado.",
      );
    if (outcome.evidenceTaskId && outcome.evidenceTaskId !== source.id)
      throw new Error(
        "A evidência deve pertencer à execução vinculada ao resultado.",
      );
    outcome.executionTaskId = source.id;

    if (outcome.type === "item_reenviado" && !outcome.receiptConfirmed)
      throw new Error(
        "Confirme o recebimento do item reenviado. O despacho sozinho não encerra a pendência.",
      );
    if (outcome.evidenceTaskId) {
      const source = related.find((task) => task.id === outcome.evidenceTaskId);
      if (
        !source?.execution ||
        source.status !== "concluida" ||
        source.kind === "revisao_status" ||
        (outcome.type === "item_reenviado" &&
          source.execution.stage !== "received") ||
        (lastReopen &&
          (!source.execution.at || source.execution.at < lastReopen.at)) ||
        source.execution.evidence !== outcome.evidence
      )
        throw new Error(
          "A evidência escolhida deve corresponder a uma execução registrada neste pedido.",
        );
    }
    if (!allowedOutcomes(order.exception).includes(outcome.type))
      throw new Error("Resultado incompatível com esta exceção.");
    if (outcome.type === "reembolso_registrado") {
      const alreadyRefunded = closureRecords({
        ...order,
        resolution: undefined,
        caseHistory: previous?.history,
      }).reduce(
        (total, record) => total.plus(record.outcome?.refund || 0),
        new Decimal(0),
      );
      if (
        !outcome.refund ||
        !new Decimal(outcome.refund).gt(0) ||
        new Decimal(outcome.refund).gt(order.value)
      )
        throw new Error(
          "Informe o reembolso positivo, sem exceder o valor do pedido.",
        );
      if (alreadyRefunded.plus(outcome.refund).gt(order.value))
        throw new Error(
          "O total de reembolsos deste pedido, incluindo etapas anteriores, não pode exceder o valor do pedido. Informe apenas o novo reembolso desta etapa.",
        );
    } else if (outcome.refund !== undefined)
      throw new Error(
        "Reembolso só pode ser registrado no resultado correspondente.",
      );
    next.resolution = { note: action.note, resolvedAt: now, outcome };
  } else {
    if (!next.resolution) throw new Error("Esta exceção já está aberta.");
    delete next.resolution;
  }
  next.history.push({
    id: eventId,
    action: action.action,
    note: action.note,
    at: now,
    ...(action.action === "review_status" ? { status: action.status } : {}),
    ...(action.action === "resolve"
      ? { outcome: next.resolution?.outcome }
      : {}),
  });
  return next;
}
