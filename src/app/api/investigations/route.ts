import { investigate, investigationInput } from "@/server/agent";
import { failure, json, session, verifyOrigin } from "@/server/http";
import { consumeLimit, getDataset } from "@/server/store";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  try { const { state } = await session(); return json(state.investigations.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); } catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request); const { id, state } = await session();
    const input = investigationInput.parse(await request.json());
    const previous = state.investigations.find(r => r.id === input.requestId);
    if (previous) return json({ investigation: previous });
    if (!process.env.GROQ_API_KEY) return json({ error: "Configure GROQ_API_KEY no servidor para executar o agente real." }, 503);
    await consumeLimit(`request:${id}:${input.requestId}`, 1);
    // Uma reserva por janela evita duas investigações simultâneas da mesma sessão.
    await consumeLimit(`concurrency:${id}:${Math.floor(Date.now() / 60000)}`, 1);
    const data = await getDataset(); const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const send = (payload: unknown) => { if (!closed) { try { controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`)); } catch { closed = true; } } };
        try {
          const run = await investigate(input, id, data, event => send({ event }));
          send({ investigation: run });
        } catch (e) {
          // Respostas de erro sanitizadas, sem revelar mensagens de rede/credenciais.
          const response = failure(e); send({ error: (await response.json()).error });
        } finally { if (!closed) controller.close(); }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "private, no-store", "X-Accel-Buffering": "no" } });
  } catch (e) { return failure(e); }
}
