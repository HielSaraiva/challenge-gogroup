import { z } from "zod";
import { queue } from "@/domain/analytics";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/store";
const weight = z.coerce.number().finite().min(0).max(100);
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await session(); const p = new URL(request.url).searchParams;
    const weights = { value: weight.parse(p.get("value") ?? 45), urgency: weight.parse(p.get("urgency") ?? 35), relationship: weight.parse(p.get("relationship") ?? 20) };
    if (Object.values(weights).every(v => v === 0)) return json({ error: "Ao menos um peso deve ser positivo." }, 400);
    return json(queue(await getDataset(), weights));
  } catch (e) { return failure(e); }
}
