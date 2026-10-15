import { z } from "zod";
import { failure, json, session, verifyOrigin } from "@/server/http";
import { acquireAgentLease, updateTask } from "@/server/store";
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
        status: z.enum(["concluida", "aprovada", "rejeitada"]),
      })
      .strict()
      .parse(await request.json());
    release = await acquireAgentLease(sessionId);
    return json(await updateTask(sessionId, input.id, input.status));
  } catch (e) {
    return failure(e);
  } finally {
    await release?.();
  }
}
