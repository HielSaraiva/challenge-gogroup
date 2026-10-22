import { failure, json, session, verifyOrigin } from "@/server/http";
import { updateTask } from "@/server/container";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { state } = await session();
    return json(state.tasks);
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    verifyOrigin(request);
    const { id } = await session();
    return json(await updateTask(id, await request.json()));
  } catch (error) {
    return failure(error);
  }
}
