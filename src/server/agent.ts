import { allowedTaskKinds } from "@/domain/task-policy";
import { insightGroupLabel } from "@/domain/labels";
import type {
  AgentContext,
  AgentCompletion,
  InvestigationInput,
} from "./agent/contracts";
import { investigationMessages } from "./agent/prompts";
import { createAgentCompletion } from "./agent/completion";
import { executeTool } from "./agent/tool-executor";
import {
  compactConsultation,
  type ConsultedFacts,
} from "./compact-agent-request";
import { withShortRateLimitRetry } from "./provider-retry";
import { insights, rankOrders, queue } from "@/domain/analytics";
import {
  STRATEGIES,
  DEFAULT_WEIGHTS,
  type DailyPlan,
  exceptionLabels,
  type Task,
  type Dataset,
  type Investigation,
  type ToolEvent,
} from "@/domain/types";
import { AppError, consumeLimit, saveInvestigation } from "./store";

// Preserve the public entry point used by route handlers and integration tests.
export { investigationInput } from "./agent/contracts";
export type { AgentContext, AgentCompletion } from "./agent/contracts";
export { agentTools } from "./agent/tool-definitions";
export { executeTool } from "./agent/tool-executor";

export async function investigate(
  input: InvestigationInput,
  sessionId: string,
  data: Dataset,
  emit: (event: ToolEvent) => void,
  completion?: AgentCompletion,
): Promise<Investigation> {
  if (!completion && !process.env.GROQ_API_KEY)
    throw new AppError(
      "Configure GROQ_API_KEY no servidor para executar o agente real.",
      503,
    );
  const pattern =
    input.type === "pattern"
      ? insights(data).find((i) => i.id === input.target)
      : null;
  if (
    input.type === "pattern"
      ? !pattern
      : input.type === "order" &&
        !data.orders.some((o) => o.id === input.target)
  )
    throw new AppError("Alvo da investigação inexistente.", 404);
  if (
    input.type === "daily" &&
    !queue(data, input.weights || DEFAULT_WEIGHTS).orders.length
  )
    throw new AppError(
      "Não há pedidos ou capacidade disponível para preparar um plano.",
      409,
    );
  if (
    input.type === "order" &&
    data.orders.find((order) => order.id === input.target)?.resolution
  )
    throw new AppError("Reabra a exceção antes de investigar.", 409);
  if (
    pattern &&
    pattern.scope !== "process" &&
    !data.orders.some(
      (order) => pattern.evidenceIds.includes(order.id) && !order.resolution,
    )
  )
    throw new AppError(
      "Este sinal não possui casos abertos nesta sessão.",
      409,
    );
  await consumeLimit(
    `session:${sessionId}`,
    Number(process.env.AGENT_SESSION_DAILY_LIMIT || 10),
  );
  await consumeLimit(
    "global",
    Number(process.env.AGENT_GLOBAL_DAILY_LIMIT || 100),
  );
  const now = new Date().toISOString();
  const run: Investigation = {
    id: input.requestId,
    type: input.type,
    target: input.target,
    status: "running",
    summary: "",
    events: [],
    taskIds: [],
    createdAt: now,
    updatedAt: now,
  };
  await saveInvestigation(sessionId, run);
  const context: AgentContext = {
    sessionId,
    runId: run.id,
    data,
    allowedIds: new Set(
      (input.type === "recurrences"
        ? data.orders.map((order) => order.id)
        : pattern
          ? pattern.evidenceIds
          : [input.target]
      ).filter(
        (id) =>
          input.type === "recurrences" ||
          pattern?.scope === "process" ||
          !data.orders.find((order) => order.id === id)?.resolution,
      ),
    ),
    consulted: new Set(),
    evidence: new Set(),
    simulated: new Set(),
    requiresPattern: Boolean(pattern),
    mode: input.type,
    requestedStrategy: input.type === "daily" ? input.strategy : undefined,
    patternId: pattern?.id,
    processInvestigation: pattern?.scope === "process",
    renewFromTaskId:
      input.type === "pattern" ? input.renewFromTaskId : undefined,
    weights: input.weights || DEFAULT_WEIGHTS,
    consultedInsights: new Set(),
  };
  const event = async (
    tool: string,
    state: ToolEvent["state"],
    message: string,
    operationId?: string,
  ) => {
    const e = {
      tool,
      state,
      message,
      operationId: operationId || `${run.id}:lifecycle`,
      at: new Date().toISOString(),
    };
    run.events.push(e);
    run.updatedAt = e.at;
    await saveInvestigation(sessionId, run);
    emit(e);
  };
  const messages = investigationMessages(input);
  const consultedFacts: ConsultedFacts = {};
  const call = createAgentCompletion(
    input,
    data,
    context,
    consultedFacts,
    pattern,
    completion,
  );
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 45000);
  let calls = 0;
  let processCreated = false;
  try {
    await event(
      "agente",
      "running",
      "Investigação iniciada. Consultando evidências da base.",
    );
    if (input.type === "daily" && !completion) {
      context.requestedStrategy = input.strategy || "equilibrada";
      context.weights = STRATEGIES[context.requestedStrategy].weights;
      for (const tool of ["consultar_diagnostico", "consultar_fila"]) {
        const operationId = `${run.id}:${tool}`;
        await event(
          tool,
          "running",
          "Consultando os indicadores calculados no servidor.",
          operationId,
        );
        await executeTool(tool, {}, context);
        await event(
          tool,
          "ok",
          "Indicadores e amostras preparados para a análise da IA.",
          operationId,
        );
      }
    }
    if (!completion && input.type !== "daily") {
      const prepare = async (name: string, args: unknown, key = name) => {
        const operationId = `${run.id}:prepared:${key}`;
        await event(
          name,
          "running",
          "Consultando evidências para a análise.",
          operationId,
        );
        const result = await executeTool(name, args, context);
        consultedFacts[key] = compactConsultation(name, result);
        if (name === "consultar_recorrencias")
          run.consultedInsightIds = context.recurrenceCandidates?.map(
            (item) => item.insightId,
          );
        await event(
          name,
          "ok",
          "Evidências consultadas e preparadas para a IA.",
          operationId,
        );
        return result;
      };
      if (input.type === "recurrences")
        await prepare("consultar_recorrencias", {});
      else if (pattern) {
        const result = (await prepare("consultar_padroes", {
          insightId: pattern.id,
        })) as { evidenceIds: string[] };
        // Include real sample facts, never a deterministic hypothesis as agent analysis.
        const sampleIds = result.evidenceIds.slice(
          0,
          pattern.scope === "process" ? 3 : 20,
        );
        consultedFacts.consultar_padroes = {
          ...(consultedFacts.consultar_padroes as object),
          evidenceIds: sampleIds,
          sample: data.orders
            .filter((o) => sampleIds.includes(o.id))
            .map((o) => ({
              id: o.id,
              exception: o.exception,
              status: o.status,
              promisedAt: o.promisedAt,
              deliveredAt: o.deliveredAt,
              carrier: o.carrier,
              state: o.state,
              machine: o.machine,
              shift: o.shift,
              dc: o.dc,
              lot: o.lot,
              gift: o.gift,
              resolved: Boolean(o.resolution),
            })),
        };
      } else {
        const facts = (await prepare("consultar_pedido", {
          orderId: input.target,
        })) as { acoesAdmitidas: string[] };
        for (const action of ["reenvio", "reembolso"]) {
          if (facts.acoesAdmitidas.includes(`proposta_${action}`))
            await prepare(
              "simular_tratativa",
              { orderId: input.target, action },
              `simulacao_${action}`,
            );
        }
      }
    }
    for (
      let round = 0;
      round <
      (!completion && (input.type !== "pattern" || pattern?.scope === "process")
        ? 2
        : 6);
      round++
    ) {
      if (abort.signal.aborted) throw new Error("Timeout");
      const response = completion
        ? await call(messages, abort.signal)
        : await withShortRateLimitRetry(
            () => call(messages, abort.signal),
            abort.signal,
          );
      if (response.usage) {
        const previous = run.tokenUsage || {
          requests: 0,
          input: 0,
          output: 0,
          total: 0,
        };
        run.tokenUsage = {
          requests: previous.requests + 1,
          input: previous.input + (response.usage.prompt_tokens || 0),
          output: previous.output + (response.usage.completion_tokens || 0),
          total: previous.total + (response.usage.total_tokens || 0),
        };
      }
      const message = response.choices[0]?.message;
      if (!message) throw new Error("EmptyResponse");
      messages.push({
        role: "assistant",
        content: message.content || null,
        ...(message.tool_calls?.length
          ? { tool_calls: message.tool_calls }
          : {}),
      });
      if (!message.tool_calls?.length) {
        messages.push({
          role: "user",
          content:
            input.type === "recurrences"
              ? "Consulte os agrupamentos e finalize com registrar_analise_recorrencias, mesmo se não houver novos achados."
              : input.type === "daily"
                ? "Ainda não foi registrado o plano. Consulte a fila e use registrar_plano_dia."
                : pattern?.scope === "process"
                  ? "Registre uma ação de processo para o padrão consultado com criar_acao_processo."
                  : "Ainda não foi criada nenhuma tarefa. Consulte evidências e registre um encaminhamento antes de concluir.",
        });
        continue;
      }
      for (const toolCall of message.tool_calls) {
        if (++calls > 12 || abort.signal.aborted) throw new Error("ToolLimit");
        const name = toolCall.function.name;
        await event(
          name,
          "running",
          `Executando ${name.replaceAll("_", " ")}.`,
          toolCall.id,
        );
        let result: unknown;
        try {
          if (
            ["criar_tarefa", "criar_acao_processo"].includes(name) &&
            run.taskIds.length >= 2
          )
            throw new AppError("Limite de duas tarefas por investigação.");
          result = await executeTool(
            name,
            JSON.parse(toolCall.function.arguments),
            context,
          );
          if (
            !completion &&
            [
              "consultar_pedido",
              "simular_tratativa",
              "consultar_padroes",
            ].includes(name)
          )
            consultedFacts[name] = compactConsultation(name, result);
          if (
            ["criar_tarefa", "criar_acao_processo"].includes(name) &&
            !run.taskIds.includes((result as Task).id)
          )
            run.taskIds.push((result as Task).id);
          if (name === "consultar_recorrencias")
            run.consultedInsightIds = context.recurrenceCandidates?.map(
              (item) => item.insightId,
            );
          if (name === "registrar_analise_recorrencias") {
            run.recurrenceReview = context.recurrenceReview;
            run.taskIds = context.recurrenceTaskIds || [];
          }
          if (name === "criar_acao_processo") processCreated = true;
          if (name === "registrar_plano_dia")
            run.planId = (result as DailyPlan).id;
          await event(
            name,
            "ok",
            name === "registrar_plano_dia"
              ? "Plano do dia registrado, com seleção e orientações por área."
              : ["criar_tarefa", "criar_acao_processo"].includes(name)
                ? `Tarefa registrada: ${(result as Task).title}`
                : "Consulta concluída com evidências verificáveis.",
            toolCall.id,
          );
        } catch (error) {
          if (input.type === "recurrences")
            run.taskIds = context.recurrenceTaskIds || [];
          const detail =
            error instanceof AppError
              ? error.message
              : "Argumentos inválidos ou falha de ferramenta. Revise a chamada.";
          result = {
            error: detail,
            evidenceIdsPermitidos: [...context.evidence],
            acoesAdmitidas: [...context.consulted].map((id) => {
              const o = data.orders.find((o) => o.id === id)!;
              return {
                orderId: id,
                evidenceIdsObrigatorios: [id],
                kinds:
                  o.status === "status_divergente"
                    ? ["revisao_status"]
                    : allowedTaskKinds[o.exception],
              };
            }),
          };
          await event(name, "error", detail, toolCall.id);
        }
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
      if (
        run.recurrenceReview ||
        run.planId ||
        (input.type !== "recurrences" &&
          (pattern?.scope === "process" ? processCreated : run.taskIds.length))
      ) {
        // Encerra após o efeito útil. O resumo usa fatos do servidor, sem outra chamada
        // que possa falhar por cota ou reinterpretar indicadores financeiros.
        const evidence = [...context.consulted]
          .map((id) => ordersForSummary(data, id))
          .join("\n");
        run.summary = run.recurrenceReview
          ? `Análise de recorrências registrada. ${run.recurrenceReview.reason}`
          : run.planId
            ? `Plano do dia registrado para ${queue(data, context.weights).orders.length} pedidos, dentro da capacidade restante de ${queue(data, context.weights).availableCapacity} tratativas. A seleção combina uma reserva para os casos mais antigos e pontuação explicável nas demais vagas. A seleção foi calculada pelas regras do sistema. O agente comparou estratégias, aplicou a estratégia escolhida, consultou amostras por área e registrou o primeiro pedido sugerido, sua justificativa e o próximo passo. O plano não cria tarefas para todos os pedidos: investigue o caso escolhido para gerar uma tarefa. Nenhuma tratativa externa ou recuperação financeira foi executada.`
            : `O agente consultou evidências e registrou ${processCreated ? "uma ação para investigar o processo" : `${run.taskIds.length} encaminhamento(s) individual(is)`} nesta sessão.\n${pattern ? `Sinal observado: ${pattern.count} de ${pattern.total} casos elegíveis no grupo ${insightGroupLabel(pattern.group)}. A concentração não comprova causa.\n` : ""}${evidence}\nA justificativa é uma hipótese do agente; os fatos verificados aparecem separadamente. O próximo passo é a revisão pela área responsável. Nenhum envio, pagamento ou recuperação financeira foi executado.`;
        run.status = "completed";
        break;
      }
    }
    if (run.status === "running") throw new Error("RoundLimit");
    await event(
      "agente",
      "ok",
      input.type === "recurrences"
        ? "Análise de recorrências concluída. Confira os achados e as investigações registradas na aba Recorrências."
        : input.type === "daily"
          ? "Preparação concluída. Confira a seleção e as orientações em “Seu plano de trabalho”."
          : input.type === "pattern"
            ? "Análise concluída. Abra a investigação em Recorrências ou Pendências para conferir a hipótese."
            : "Análise concluída. Confira as tarefas em “Encaminhamentos para este pedido”.",
    );
  } catch (error) {
    const provider = error as {
      status?: number;
      name?: string;
      error?: { code?: unknown; error?: { code?: unknown } };
    };
    const safeTag = (value: unknown) =>
      typeof value === "string" && /^[a-zA-Z_][a-zA-Z_0-9]{0,63}$/.test(value)
        ? value
        : undefined;
    run.failure = {
      status: Number.isInteger(provider.status) ? provider.status : undefined,
      code: safeTag(provider.error?.code ?? provider.error?.error?.code),
      type: safeTag(provider.name),
    };
    console.warn("agent_run_interrupted", {
      status: provider.status,
      type: provider.name,
    });
    run.status = "failed";
    run.summary =
      run.taskIds.length || run.planId
        ? "Execução interrompida. O plano e as tarefas já registrados foram preservados; confira os registros em Hoje, no pedido ou em Recorrências antes de tentar novamente."
        : provider.status === 429
          ? "O Groq atingiu o limite de uso. A execução foi interrompida. Aguarde a renovação da cota e tente novamente. As ações já registradas foram preservadas."
          : provider.status === 401
            ? "O Groq recusou a credencial. Verifique GROQ_API_KEY no servidor."
            : provider.status === 404
              ? "Modelo indisponível na conta Groq. Verifique GROQ_MODEL."
              : "O agente não concluiu a investigação. Verifique disponibilidade, modelo, cota e chave Groq e tente novamente.";
    await event("agente", "error", run.summary);
  } finally {
    clearTimeout(timer);
    run.updatedAt = new Date().toISOString();
    await saveInvestigation(sessionId, run);
  }
  return run;
}
function ordersForSummary(data: Dataset, id: string) {
  const o = rankOrders(data).find((o) => o.id === id)!;
  return `Pedido ${o.id}: ${exceptionLabels[o.exception]}; ${o.priority.age} dias úteis desde a abertura; ${o.priority.delay} dias úteis de atraso${o.deliveredAt ? " até a entrega" : " na referência"}; prioridade ${o.priority.score.toFixed(1)}/100.`;
}
