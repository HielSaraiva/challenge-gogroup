import { describe, expect, it } from "vitest";
import { latestPatternTask, patternDecision } from "@/domain/pattern-lifecycle";
import type { Task } from "@/domain/types";

const original: Task = {
  id: "original",
  scope: "process",
  insightId: "signal",
  kind: "melhoria_processo",
  orderId: "pedido",
  investigationId: "run",
  title: "Investigar a recorrência",
  justification: "Conferir a hipótese do processo",
  area: "Operações",
  evidenceIds: ["pedido", "outro"],
  dueAt: "2026-10-01",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  idempotencyKey: "original",
  status: "aberta",
};
const completed: Task = {
  ...original,
  status: "concluida",
  conclusion: {
    outcome: "inconclusiva",
    observations: "A amostra ainda não permite atribuir a causa",
    evidenceIds: ["pedido", "outro"],
    nextStep: "Ampliar a verificação com a equipe",
  },
};
describe("ciclo de investigação de recorrência", () => {
  it("abre a existente sem solicitar nova análise, inclusive quando já concluída", () => {
    expect(patternDecision([original], "signal")).toEqual({
      kind: "reuse",
      task: original,
    });
    expect(patternDecision([completed], "signal")).toEqual({
      kind: "reuse",
      task: completed,
    });
    expect(patternDecision([original], "signal", original.id)).toEqual({
      kind: "reuse",
      task: original,
    });
  });
  it("cria uma nova etapa somente a partir da conclusão mais recente", () => {
    expect(patternDecision([completed], "signal", completed.id)).toEqual({
      kind: "create",
      previousTaskId: completed.id,
    });
    expect(() =>
      patternDecision([completed], "signal", "registro-antigo"),
    ).toThrow("mudou");
    expect(() => patternDecision([], "signal", completed.id)).toThrow("mudou");
  });
  it("segue a relação entre etapas, sem depender da ordem de retorno do banco", () => {
    const latest = { ...original, id: "nova", previousTaskId: completed.id };
    expect(latestPatternTask([latest, completed], "signal")?.id).toBe("nova");
    expect(
      patternDecision([latest, completed], "signal", completed.id),
    ).toEqual({ kind: "reuse", task: latest });
    expect(
      latestPatternTask([latest, completed], "outro-sinal"),
    ).toBeUndefined();
  });
});
