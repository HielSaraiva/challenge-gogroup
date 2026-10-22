import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createSession,
  getDataset,
  getSession,
  saveInvestigation,
  saveSessionDataset,
} from "../../src/infrastructure/persistence/operations-store";
import { importDataset } from "../../src/domain/import";
import { GET, POST } from "../../src/app/api/data/route";
let sessionId = "";
vi.mock("../../src/server/http", async (original) => ({
  ...(await original<typeof import("../../src/server/http")>()),
  session: async () => ({
    id: sessionId,
    state: (await getSession(sessionId))!,
  }),
}));
const csv = (rows: Record<string, string>[]) =>
  [
    Object.keys(rows[0]).join(","),
    ...rows.map((row) => Object.values(row).join(",")),
  ].join("\n");
const order = {
  order_id: "SYN-1",
  customer_id: "SYN-C",
  marca: "Sintética",
  data_pedido: "2026-09-01",
  valor: "100.00",
  sku: "SYN-SKU",
  descricao_produto: "Teste",
  qtd_itens: "1",
  brinde_no_pedido: "False",
  tipo_excecao: "atraso_entrega",
  status: "aberta",
  transportadora: "Sintética",
  uf: "SP",
  cidade: "Teste",
  data_prometida: "2026-09-04",
  data_entrega: "",
  maquina: "",
  turno: "manhã",
  cd: "CD1",
  lote_produto: "L1",
  data_abertura_excecao: "2026-09-08",
};
const files = {
  orders: csv([order, { ...order, status: "em_analise" }]),
  customers: csv([
    {
      customer_id: "SYN-C",
      n_pedidos: "1",
      receita_acumulada: "100.00",
      data_primeiro_pedido: "2026-09-01",
      n_contatos_atendimento: "0",
    },
  ]),
  carriers: csv([
    {
      transportadora: "Sintética",
      uf_atendida: "SP",
      sla_contratado_dias_uteis: "3",
      custo_medio_frete: "12.00",
    },
  ]),
};
const request = (mode = "preview", changed = files) =>
  new Request("http://localhost:3000/api/data", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify({ mode, files: changed }),
  });
beforeEach(async () => {
  sessionId = randomUUID();
  await createSession(sessionId);
});
describe("importação isolada com confirmação", () => {
  it("prévia consolida conflitos e não grava a base", async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({
      committed: false,
      sourceRows: 2,
      orders: 1,
      duplicates: 1,
      conflicts: 1,
    });
    expect((await getSession(sessionId))!.importedDataset).toBeUndefined();
  });
  it("confirma e recupera somente na sessão que importou", async () => {
    expect((await POST(request("commit"))).status).toBe(200);
    const state = (await getSession(sessionId))!;
    expect((await getDataset(state)).orders[0].status).toBe(
      "status_divergente",
    );
    const other = await createSession(randomUUID());
    expect(other.importedDataset).toBeUndefined();
    expect(await (await GET()).json()).toMatchObject({
      available: true,
      source: "session",
      orders: 1,
    });
    sessionId = randomUUID();
    await createSession(sessionId);
    expect((await getSession(sessionId))!.importedDataset).toBeUndefined();
  });
  it("não mistura nova base com histórico ativo", async () => {
    const data = importDataset(files);
    await saveSessionDataset(sessionId, data);
    await saveInvestigation(sessionId, {
      id: randomUUID(),
      target: "SYN-1",
      type: "order",
      status: "failed",
      summary: "Teste",
      events: [],
      taskIds: [],
      createdAt: "",
      updatedAt: "",
    });
    const result = await POST(request("commit"));
    expect(result.status).toBe(409);
    expect((await getSession(sessionId))!.importedDataset).toEqual(data);
  });
  it("rejeita campo inválido indicando arquivo e linha", async () => {
    const result = await POST(
      request("preview", {
        ...files,
        orders: csv([{ ...order, valor: "inválido" }]),
      }),
    );
    expect(result.status).toBe(400);
    expect((await result.json()).error).toContain(
      "pedidos_excecao.csv, linha 2",
    );
  });
  it("rejeita cabeçalho sem registros e relacionamentos inexistentes", async () => {
    expect(
      (
        await POST(
          request("commit", { ...files, orders: Object.keys(order).join(",") }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          request("commit", {
            ...files,
            orders: csv([{ ...order, customer_id: "missing" }]),
          }),
        )
      ).status,
    ).toBe(400);
    expect((await getSession(sessionId))!.importedDataset).toBeUndefined();
  });
  it("bloqueia um retrato posterior à referência operacional", async () => {
    const result = await POST(
      request("commit", {
        ...files,
        orders: csv([{ ...order, data_abertura_excecao: "2026-10-01" }]),
      }),
    );
    expect(result.status).toBe(400);
    expect((await getSession(sessionId))!.importedDataset).toBeUndefined();
  });
  it("não expõe conteúdo de CSV em erro de parser", async () => {
    const result = await POST(
      request("preview", { ...files, orders: 'order_id\n"SENSITIVE_UNCLOSED' }),
    );
    expect(result.status).toBe(400);
    expect(JSON.stringify(await result.json())).not.toContain("SENSITIVE");
  });
  it("rejeita origem externa e corpo excessivo", async () => {
    const foreign = request();
    foreign.headers.set("origin", "https://external.invalid");
    expect((await POST(foreign)).status).toBe(403);
    const large = new Request("http://localhost:3000/api/data", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: " ".repeat(3_000_001),
    });
    expect((await POST(large)).status).toBe(413);
  });
});
