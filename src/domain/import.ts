import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";
import { z } from "zod";
import { addBusinessDays } from "./calendar";
import type { Dataset, Order } from "./types";
const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine((v) => {
    try {
      return new Decimal(v).gte(0);
    } catch {
      return false;
    }
  });
const day = z.iso.date();
const count = z.coerce.number().int().nonnegative();
const csv = (text: string): Record<string, string>[] =>
  parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 16000,
  });
function row<T>(
  schema: z.ZodType<T>,
  value: unknown,
  file: string,
  index: number,
): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new Error(
      `${file}, linha ${index + 2}: revise o campo ${result.error.issues[0]?.path.join(".") || "registro"}.`,
    );
  return result.data;
}
const customerSchema = z.object({
  customer_id: z.string().min(1),
  n_pedidos: count.positive(),
  receita_acumulada: money,
  data_primeiro_pedido: day,
  n_contatos_atendimento: count,
});
const carrierSchema = z.object({
  transportadora: z.string().min(1),
  uf_atendida: z.string().length(2),
  sla_contratado_dias_uteis: count,
  custo_medio_frete: money,
});
const orderSchema = z.object({
  order_id: z.string().min(1),
  customer_id: z.string().min(1),
  marca: z.string().min(1),
  data_pedido: day,
  valor: money,
  sku: z.string().min(1),
  descricao_produto: z.string(),
  qtd_itens: count.positive(),
  brinde_no_pedido: z.enum(["True", "False"]),
  tipo_excecao: z.enum([
    "atraso_entrega",
    "extravio",
    "rastreio_parado",
    "devolvido_transportadora",
    "avaria_transporte",
    "vazamento_produto",
    "item_faltante",
    "falha_personalizacao",
    "pagamento_pendente",
    "ruptura_pos_venda",
    "endereco_divergente",
  ]),
  status: z.enum([
    "aberta",
    "em_analise",
    "aguardando_transportadora",
    "aguardando_cliente",
  ]),
  transportadora: z.string(),
  uf: z.string().length(2),
  cidade: z.string(),
  data_prometida: day,
  data_entrega: z.union([day, z.literal("")]),
  maquina: z.string(),
  turno: z.string(),
  cd: z.string(),
  lote_produto: z.string(),
  data_abertura_excecao: day,
});
export function importDataset(files: {
  orders: string;
  customers: string;
  carriers: string;
}): Dataset {
  const customers = csv(files.customers).map((value, i) => {
    const r = row(customerSchema, value, "clientes.csv", i);
    return {
      id: r.customer_id,
      orders: r.n_pedidos,
      revenue: r.receita_acumulada,
      firstOrder: r.data_primeiro_pedido,
      contacts: r.n_contatos_atendimento,
    };
  });
  const carriers = csv(files.carriers).map((value, i) => {
    const r = row(carrierSchema, value, "transportadoras.csv", i);
    return {
      name: r.transportadora,
      state: r.uf_atendida,
      sla: r.sla_contratado_dias_uteis,
      freight: r.custo_medio_frete,
    };
  });
  if (new Set(customers.map((c) => c.id)).size !== customers.length)
    throw new Error("Clientes duplicados.");
  if (
    new Set(carriers.map((c) => `${c.name}|${c.state}`)).size !==
    carriers.length
  )
    throw new Error("Contratos duplicados.");
  const source = csv(files.orders);
  const grouped = new Map<string, Order>();
  const customerIds = new Set(customers.map((c) => c.id));
  const contracts = new Map(carriers.map((c) => [`${c.name}|${c.state}`, c]));
  for (const [i, value] of source.entries()) {
    const r = row(orderSchema, value, "pedidos_excecao.csv", i);
    if (!customerIds.has(r.customer_id))
      throw new Error(`Cliente inexistente: ${r.order_id}`);
    const carrier = contracts.get(`${r.transportadora}|${r.uf}`);
    if (!carrier) throw new Error(`Contrato inexistente: ${r.order_id}`);
    const previous = grouped.get(r.order_id);
    const order: Order = {
      id: r.order_id,
      customerId: r.customer_id,
      brand: r.marca,
      orderedAt: r.data_pedido,
      value: r.valor,
      sku: r.sku,
      product: r.descricao_produto,
      quantity: r.qtd_itens,
      gift: r.brinde_no_pedido === "True",
      exception: r.tipo_excecao,
      sourceStatuses: [r.status],
      status: r.status,
      carrier: r.transportadora,
      state: r.uf,
      city: r.cidade,
      promisedAt: r.data_prometida,
      deliveredAt: r.data_entrega || null,
      machine: r.maquina,
      shift: r.turno,
      dc: r.cd,
      lot: r.lote_produto,
      openedAt: r.data_abertura_excecao,
      issues: [],
    };
    if (previous) {
      const comparable = (o: Order) =>
        JSON.stringify({ ...o, status: "", sourceStatuses: [], issues: [] });
      if (comparable(previous) !== comparable(order))
        throw new Error(`Conflito além do status: ${r.order_id}`);
      if (!previous.sourceStatuses.includes(r.status))
        previous.sourceStatuses.push(r.status);
      if (previous.sourceStatuses.length > 1) {
        previous.status = "status_divergente";
        if (!previous.issues.some((i) => i.code === "STATUS_CONFLICT"))
          previous.issues.push({
            code: "STATUS_CONFLICT",
            detail:
              "Sem timestamp para determinar o status mais recente. Revisão humana necessária.",
          });
      }
    } else {
      if (
        addBusinessDays(order.orderedAt, 1 + carrier.sla) !== order.promisedAt
      )
        order.issues.push({
          code: "PROMISE_MISMATCH",
          detail: "Promessa original difere de separação + SLA em dias úteis.",
        });
      grouped.set(order.id, order);
    }
  }
  return {
    orders: [...grouped.values()],
    customers,
    carriers,
    sourceRows: source.length,
    importedAt: new Date().toISOString(),
  };
}
