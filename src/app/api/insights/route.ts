import { insights } from "@/domain/analytics";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/store";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await session();
    return json(insights(await getDataset()));
  } catch (e) {
    return failure(e);
  }
}
