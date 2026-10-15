import { z } from "zod";
import { rankOrders } from "@/domain/analytics";
import { failure, json, session } from "@/server/http";
import { getDataset } from "@/server/store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await session(); const params = new URL(request.url).searchParams;
    const limit = z.coerce.number().int().min(1).max(2000).parse(params.get("limit") || 50);
    const page = z.coerce.number().int().min(1).max(10000).parse(params.get("page") || 1);
    const query = (params.get("q") || "").slice(0, 150).toLocaleLowerCase("pt-BR");
    const orders = rankOrders(await getDataset()).filter(o => (!params.get("id") || o.id === params.get("id")) && (!params.get("type") || o.exception === params.get("type")) && (!params.get("status") || o.status === params.get("status")) && (!params.get("brand") || o.brand === params.get("brand")) && `${o.id} ${o.brand} ${o.product} ${o.city}`.toLocaleLowerCase("pt-BR").includes(query));
    return json({ orders: orders.slice((page - 1) * limit, page * limit), total: orders.length, page, limit });
  } catch (e) { return failure(e); }
}
