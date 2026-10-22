import { workspaceSnapshot } from "@/domain/workspace";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/container";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { state } = await session();
    return json(workspaceSnapshot(await getDataset(state), state));
  } catch (error) {
    return failure(error);
  }
}
