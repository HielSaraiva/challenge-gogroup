import { z } from "zod";
import { REFERENCE_DATE } from "@/domain/types";
import { importDataset } from "@/domain/import";
import { dashboard } from "@/domain/analytics";
import { failure, json, session, verifyOrigin } from "@/server/http";
import {
  AppError,
  acquireAgentLease,
  getDataset,
  saveSessionDataset,
} from "@/server/store";

export const dynamic = "force-dynamic";
const input = z
  .object({
    mode: z.enum(["preview", "commit"]),
    files: z
      .object({
        orders: z.string().min(1).max(1_500_000),
        customers: z.string().min(1).max(1_500_000),
        carriers: z.string().min(1).max(100_000),
      })
      .strict(),
  })
  .strict();

export async function GET() {
  try {
    const { state } = await session();
    let data;
    try {
      data = await getDataset(state);
    } catch (error) {
      if (!(error instanceof AppError) || error.status !== 503) throw error;
    }
    return json({
      available: Boolean(data),
      source: state.importedDataset ? "session" : "administrator",
      importedAt: data?.importedAt,
      sourceRows: data?.sourceRows,
      orders: data?.orders.length,
      canImport:
        !state.tasks.length &&
        !state.investigations.length &&
        !Object.keys(state.cases || {}).length,
    });
  } catch (error) {
    return failure(error);
  }
}

// Read a bounded body even when Content-Length is absent or incorrect.
async function readInput(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("Selecione os três arquivos CSV.");
  let length = 0;
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 3_000_000) {
        await reader.cancel();
        throw new AppError("Os arquivos excedem o limite total de 2 MB.", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return input.parse(JSON.parse(text + decoder.decode()));
  } finally {
    reader.releaseLock();
  }
}
export async function POST(request: Request) {
  let release: (() => Promise<void>) | undefined;
  try {
    verifyOrigin(request);
    const { id } = await session();
    const body = await readInput(request);
    if (
      Object.values(body.files).reduce((n, s) => n + Buffer.byteLength(s), 0) >
      2_000_000
    )
      throw new AppError("Os arquivos excedem o limite total de 2 MB.", 413);
    let data;
    try {
      data = importDataset(body.files);
    } catch (error) {
      // Only controlled domain errors are exposed; parser details may contain CSV contents.
      const message =
        error instanceof Error &&
        /^(clientes\.csv|transportadoras\.csv|pedidos_excecao\.csv|Clientes duplicados|Contratos duplicados|Cliente inexistente|Contrato inexistente|Conflito além do status)/.test(
          error.message,
        )
          ? error.message
          : "CSV inválido. Confira o cabeçalho, as colunas e a codificação UTF-8.";
      throw new AppError(message);
    }
    if (!data.orders.length || !data.customers.length || !data.carriers.length)
      throw new AppError(
        "Os três arquivos devem conter registros além do cabeçalho.",
      );
    if (
      data.orders.length > 10000 ||
      data.customers.length > 10000 ||
      data.carriers.length > 2000
    )
      throw new AppError(
        "O piloto aceita até 10 mil pedidos, 10 mil clientes e 2 mil contratos.",
        413,
      );
    if (
      data.orders.some(
        (order) =>
          order.orderedAt > REFERENCE_DATE ||
          order.openedAt > REFERENCE_DATE ||
          (order.deliveredAt && order.deliveredAt > REFERENCE_DATE),
      )
    )
      throw new AppError(
        "A base contém pedidos ou eventos posteriores a 30/09/2026. Este piloto usa uma referência fixa; revise o período dos arquivos.",
      );
    const stats = dashboard(data);
    if (body.mode === "commit") {
      release = await acquireAgentLease(id);
      await saveSessionDataset(id, data);
    }
    return json({
      committed: body.mode === "commit",
      orders: stats.totalCount,
      sourceRows: stats.sourceRows,
      duplicates: stats.sourceRows - stats.totalCount,
      conflicts: stats.conflicts,
      promiseMismatches: stats.promiseMismatches,
    });
  } catch (error) {
    return failure(error);
  } finally {
    await release?.();
  }
}
