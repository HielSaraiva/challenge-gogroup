import { planQueue } from "@/domain/planning";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/container";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { state } = await session();
    return json(planQueue(await getDataset(state), state));
  } catch (error) {
    return failure(error);
  }
}
