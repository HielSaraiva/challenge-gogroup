import { dashboard } from "@/domain/analytics";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/store";
import { sessionDataset } from "@/domain/cases";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { state } = await session();
    return json(dashboard(sessionDataset(await getDataset(state), state)));
  } catch (e) {
    return failure(e);
  }
}
