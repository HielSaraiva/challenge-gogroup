import { insights } from "@/domain/analytics";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/container";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { state } = await session();
    return json(insights(await getDataset(state)));
  } catch (e) {
    return failure(e);
  }
}
