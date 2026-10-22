import Groq from "groq-sdk";
import type { Dataset, Insight } from "@/domain/types";
import { allowedTaskKinds } from "@/domain/task-policy";
import { compactDailyRequest } from "@/application/agent/daily-request";
import {
  compactAgentRequest,
  type ConsultedFacts,
} from "@/application/agent/compact-agent-request";
import { strategicTools } from "@/application/agent/agent-actions";
import { recurrenceTools } from "@/application/agent/recurrence-discovery";
import { agentTools } from "@/application/agent/tool-definitions";
import type {
  AgentContext,
  AgentCompletion,
  InvestigationInput,
} from "@/application/agent/contracts";

export function createAgentCompletion(
  input: InvestigationInput,
  data: Dataset,
  context: AgentContext,
  consultedFacts: ConsultedFacts,
  pattern: Insight | null | undefined,
  completion?: AgentCompletion,
): AgentCompletion {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  const client = completion
    ? null
    : new Groq({
        apiKey: process.env.GROQ_API_KEY,
        maxRetries: 0,
        timeout: 12000,
      });
  return (
    completion ||
    (async (messages, signal) => {
      if (input.type === "recurrences") {
        return client!.chat.completions.create(
          {
            model,
            ...compactAgentRequest(
              context,
              consultedFacts,
              recurrenceTools.filter(
                (tool) =>
                  tool.function?.name === "registrar_analise_recorrencias",
              ),
              messages,
            ),
            temperature: 0.1,
            ...(model.startsWith("openai/gpt-oss-")
              ? { reasoning_effort: "low" as const }
              : {}),
          },
          { signal },
        );
      }
      if (input.type === "daily") {
        return client!.chat.completions.create(
          {
            model,
            ...compactDailyRequest(context, messages),
            temperature: 0.1,
            ...(model.startsWith("openai/gpt-oss-")
              ? { reasoning_effort: "low" as const }
              : {}),
          },
          { signal },
        );
      }
      if (pattern?.scope === "process" && context.patternConsulted) {
        const tools = structuredClone(
          strategicTools.filter(
            (tool) => tool.function?.name === "criar_acao_processo",
          ),
        );
        return client!.chat.completions.create(
          {
            model,
            ...compactAgentRequest(context, consultedFacts, tools, messages),
            temperature: 0.1,
            ...(model.startsWith("openai/gpt-oss-")
              ? { reasoning_effort: "low" as const }
              : {}),
          },
          { signal },
        );
      }
      const tools = structuredClone(agentTools);
      const permittedKinds = [
        ...new Set(
          [...context.consulted].flatMap((id) => {
            const o = data.orders.find((o) => o.id === id)!;
            return o.status === "status_divergente"
              ? ["revisao_status"]
              : allowedTaskKinds[o.exception] || [];
          }),
        ),
      ];
      const createTool = tools.find(
        (t) => t.function?.name === "criar_tarefa",
      )!;
      const parameters = createTool.function!.parameters as {
        properties: Record<string, unknown>;
      };
      parameters.properties.kind = { type: "string", enum: permittedKinds };
      parameters.properties.orderId = {
        type: "string",
        enum: [...context.consulted],
      };
      parameters.properties.evidenceIds = {
        type: "array",
        items: { type: "string", enum: [...context.evidence] },
        minItems: 1,
        maxItems: 20,
        description:
          "IDs exatos de pedidos consultados. Inclua o orderId da tarefa. Não use nomes de campo ou códigos de problema.",
      };
      const orderReady = input.type === "order";
      const visibleTools =
        pattern && !context.patternConsulted
          ? tools.filter((t) => t.function?.name === "consultar_padroes")
          : !context.consulted.size
            ? tools.filter((t) => t.function?.name === "consultar_pedido")
            : tools.filter((t) =>
                (orderReady
                  ? ["criar_tarefa"]
                  : ["criar_tarefa", "simular_tratativa"]
                ).includes(t.function!.name),
              );
      return client!.chat.completions.create(
        {
          model,
          ...compactAgentRequest(
            context,
            consultedFacts,
            visibleTools,
            messages,
          ),
          temperature: 0.15,
          ...(model.startsWith("openai/gpt-oss-")
            ? { reasoning_effort: "low" as const }
            : {}),
        },
        { signal },
      );
    })
  );
}
