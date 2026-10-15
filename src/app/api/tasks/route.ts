import { z } from "zod";
import { failure, json, session, verifyOrigin } from "@/server/http";
import { updateTask } from "@/server/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const { state } = await session(); return json(state.tasks); } catch (e) { return failure(e); }
}
export async function PATCH(request: Request) {
  try {
    verifyOrigin(request); const { id: sessionId } = await session();
    const input = z.object({ id: z.uuid(), status: z.enum(["concluida", "aprovada", "rejeitada"]) }).strict().parse(await request.json());
    return json(await updateTask(sessionId, input.id, input.status));
  } catch (e) { return failure(e); }
}
