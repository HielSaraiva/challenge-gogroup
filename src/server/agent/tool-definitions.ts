import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { TASK_KINDS } from "@/domain/types";

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[],
) => ({ type: "object", properties, required, additionalProperties: false });
const stringField = { type: "string" };
export const agentTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "consultar_pedido",
      description:
        "Consulta fatos de um pedido e cálculos. Obrigatório antes de criar tarefa para ele.",
      parameters: objectSchema({ orderId: stringField }, ["orderId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_padroes",
      description:
        "Consulta uma concentração estatística na base de exceções, com IDs de evidência. Não prova causa.",
      parameters: objectSchema({ insightId: stringField }, ["insightId"]),
    },
  },
  {
    type: "function",
    function: {
      name: "simular_tratativa",
      description:
        "Calcula custo de reenvio ou reembolso. Não executa transações. Obrigatório antes de proposta financeira.",
      parameters: objectSchema(
        {
          orderId: stringField,
          action: { type: "string", enum: ["reenvio", "reembolso"] },
        },
        ["orderId", "action"],
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description:
        "Registra tarefa interna com evidências já consultadas. Área e prazo são definidos pelo servidor. Proposta financeira exige aprovação humana.",
      parameters: objectSchema(
        {
          orderId: stringField,
          kind: { type: "string", enum: [...TASK_KINDS] },
          title: stringField,
          justification: {
            type: "string",
            description:
              "Justificativa qualitativa SEM dígitos, números, valores, datas, porcentagens ou prazos. Não copie métricas do pedido. Exemplo válido: Conferir o rastreio e registrar o encaminhamento a partir das evidências do pedido. Os números e o prazo são preenchidos pelo servidor.",
          },
          evidenceIds: {
            type: "array",
            items: stringField,
            minItems: 1,
            maxItems: 20,
          },
        },
        ["orderId", "kind", "title", "justification", "evidenceIds"],
      ),
    },
  },
];
