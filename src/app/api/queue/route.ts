import { queue } from "@/domain/analytics";
import { sessionDataset } from "@/domain/cases";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/store";
import { parseWeights } from "@/server/weights";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { state } = await session();
    const p = new URL(request.url).searchParams;
    return json(
      queue(sessionDataset(await getDataset(state), state), parseWeights(p)),
    );
  } catch (e) {
    return failure(e);
  }
}
