import { z } from "zod";
import { rankOrders } from "@/domain/analytics";
import { failure, json, session, verifyOrigin } from "@/server/http";
import {
  AppError,
  acquireAgentLease,
  getDataset,
  getSession,
  saveCase,
} from "@/server/store";
import {
  caseActionSchema,
  sessionDataset,
  transitionCase,
} from "@/domain/cases";
import { parseWeights } from "@/server/weights";
import { randomUUID } from "node:crypto";
import { usedDailyCapacity } from "@/domain/operations";
import { CAPACITY } from "@/domain/types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { state } = await session();
    const params = new URL(request.url).searchParams;
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(2000)
      .parse(params.get("limit") || 50);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(params.get("page") || 1);
    const query = (params.get("q") || "")
      .slice(0, 150)
      .toLocaleLowerCase("pt-BR");
    const orders = rankOrders(
      sessionDataset(await getDataset(), state),
      parseWeights(params),
    ).filter(
      (o) =>
        (!params.get("id") || o.id === params.get("id")) &&
        (!params.get("type") || o.exception === params.get("type")) &&
        (!params.get("status") || o.status === params.get("status")) &&
        (!params.get("brand") || o.brand === params.get("brand")) &&
        `${o.id} ${o.brand} ${o.product} ${o.city}`
          .toLocaleLowerCase("pt-BR")
          .includes(query),
    );
    return json({
      orders: orders.slice((page - 1) * limit, page * limit),
      total: orders.length,
      page,
      limit,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  let release: (() => Promise<void>) | undefined;
  try {
    verifyOrigin(request);
    const { id } = await session();
    const input = caseActionSchema.parse(await request.json());
    release = await acquireAgentLease(id);
    const state = await getSession(id);
    if (!state) throw new AppError("Sessão expirada.", 401);
    const data = await getDataset();
    if (
      input.action === "resolve" &&
      usedDailyCapacity(sessionDataset(data, state)) >= CAPACITY
    )
      throw new AppError(
        "A capacidade operacional do dia foi consumida. Reabrir casos não devolve o esforço já realizado.",
        409,
      );
    const order = data.orders.find((o) => o.id === input.orderId);
    if (!order) throw new AppError("Pedido não encontrado.", 404);
    let record;
    try {
      record = transitionCase(
        order,
        state.cases?.[order.id],
        state.tasks,
        input,
        randomUUID(),
        new Date().toISOString(),
      );
    } catch (error) {
      throw new AppError((error as Error).message, 409);
    }
    await saveCase(id, record);
    return json(record);
  } catch (error) {
    return failure(error);
  } finally {
    await release?.();
  }
}
