import { operationalReport } from "@/domain/operations";
import { sessionDataset } from "@/domain/cases";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/store";
import { parseWeights } from "@/server/weights";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { state } = await session();
    const data = sessionDataset(await getDataset(state), state);
    return json({
      ...operationalReport(
        data,
        state,
        parseWeights(new URL(request.url).searchParams),
      ),
      plans: [...(state.plans || [])].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
