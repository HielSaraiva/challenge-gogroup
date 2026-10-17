import { currentCaseTasks } from "@/domain/case-cycle";
import {
  executionSchema,
  conclusionSchema,
  rejectionSchema,
} from "@/domain/task-results";
import { z } from "zod";
import { failure, json, session, verifyOrigin } from "@/server/http";
import {
  AppError,
  acquireAgentLease,
  completeTaskAndResolve,
  updateTask,
  getSession,
} from "@/server/store";
import { outcomeSchema } from "@/domain/cases";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { state } = await session();
    return json(state.tasks);
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  let release: (() => Promise<void>) | undefined;
  try {
    verifyOrigin(request);
    const { id: sessionId } = await session();
    const input = z
      .object({
        id: z.uuid(),
        execution: executionSchema.optional(),
        conclusion: conclusionSchema.optional(),
        resolution: outcomeSchema.optional(),
        rejection: rejectionSchema.optional(),
        status: z.enum(["concluida", "aprovada", "rejeitada"]),
      })
      .strict()
      .parse(await request.json());
    release = await acquireAgentLease(sessionId);
    const state = await getSession(sessionId);
    if (!state) throw new AppError("Sessão expirada.", 401);
    const task = state.tasks.find((item) => item.id === input.id);
    if (
      task?.scope !== "process" &&
      task &&
      state.cases?.[task.orderId]?.resolution
    )
      throw new AppError(
        "O pedido está encerrado. Reabra para iniciar outra tratativa.",
        409,
      );
    if (
      input.status === "rejeitada"
        ? !input.rejection ||
          input.execution ||
          input.conclusion ||
          input.resolution
        : Boolean(input.rejection)
    )
      throw new AppError(
        "Para rejeitar a proposta, informe o motivo sem registrar execução ou resultado.",
      );
    if (
      input.status === "aprovada" &&
      (input.execution || input.conclusion || input.resolution)
    )
      throw new AppError(
        "Aprovar a proposta não registra execução nem encerra o pedido.",
      );
    if (
      task &&
      task.scope !== "process" &&
      !currentCaseTasks(
        { id: task.orderId, caseHistory: state.cases?.[task.orderId]?.history },
        [task],
      ).length
    )
      throw new AppError(
        "Esta tarefa pertence a uma etapa anterior. Investigue o pedido reaberto novamente.",
        409,
      );
    if (task?.kind === "revisao_status")
      throw new AppError(
        "Confirme o status no formulário do pedido. A tarefa de revisão será atualizada automaticamente.",
        409,
      );
    if (input.resolution) {
      if (input.status !== "concluida" || !input.execution || input.conclusion)
        throw new AppError(
          "Para encerrar, informe a execução da tarefa e o resultado do pedido.",
        );
      return json(
        await completeTaskAndResolve(
          sessionId,
          input.id,
          input.execution,
          input.resolution,
        ),
      );
    }
    return json(
      await updateTask(
        sessionId,
        input.id,
        input.status,
        input.execution,
        input.conclusion,
        input.rejection,
      ),
    );
  } catch (e) {
    return failure(e);
  } finally {
    await release?.();
  }
}
