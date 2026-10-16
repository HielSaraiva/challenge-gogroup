import { investigate, investigationInput } from "@/server/agent";
import { failure, json, session, verifyOrigin } from "@/server/http";
import {
  AppError,
  acquireAgentLease,
  consumeLimit,
  getDataset,
  getSession,
  saveInvestigation,
} from "@/server/store";
import { sessionDataset } from "@/domain/cases";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  try {
    const { state } = await session();
    for (const run of state.investigations) {
      if (
        run.status === "running" &&
        Date.now() - new Date(run.updatedAt).getTime() > 70000
      ) {
        run.status = "failed";
        run.summary =
          "A execução foi interrompida antes de concluir. As ações já registradas foram preservadas. Consulte as tarefas e tente novamente.";
        const { id } = await session();
        await saveInvestigation(id, run);
      }
    }
    return json(
      state.investigations.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const { id, state } = await session();
    const input = investigationInput.parse(await request.json());
    const previous = state.investigations.find((r) => r.id === input.requestId);
    if (previous) return json({ investigation: previous });
    if (!process.env.GROQ_API_KEY)
      return json(
        {
          error:
            "Configure GROQ_API_KEY no servidor para executar o agente real.",
        },
        503,
      );
    const release = await acquireAgentLease(id);
    let data: Awaited<ReturnType<typeof getDataset>>;
    try {
      const latestState = await getSession(id);
      if (!latestState) throw new AppError("Sessão expirada.", 401);
      data = sessionDataset(await getDataset(latestState), latestState);
      await consumeLimit(`request:${id}:${input.requestId}`, 1);
    } catch (error) {
      await release();
      throw error;
    }
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (payload: unknown) => {
          if (!closed) {
            try {
              controller.enqueue(
                encoder.encode(`${JSON.stringify(payload)}\n`),
              );
            } catch {
              closed = true;
            }
          }
        };
        try {
          const run = await investigate(input, id, data, (event) =>
            send({ event }),
          );
          send({ investigation: run });
        } catch (e) {
          // Respostas de erro sanitizadas, sem revelar mensagens de rede/credenciais.
          const response = failure(e);
          send({ error: (await response.json()).error });
        } finally {
          await release();
          if (!closed) controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
