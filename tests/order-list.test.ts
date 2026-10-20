import { describe, expect, it } from "vitest";
import type { RankedOrder } from "@/domain/types";
import { orderList, PAGE_SIZES } from "@/lib/order-list";

const source = [
  {
    id: "B",
    orderedAt: "2026-08-01",
    openedAt: "2026-09-20",
    exception: "atraso_entrega",
    status: "aberta",
    brand: "Marca",
    product: "Caneca",
  },
  {
    id: "C",
    orderedAt: "2026-09-01",
    openedAt: "2026-09-01",
    exception: "endereco_divergente",
    status: "status_divergente",
    brand: "Marca",
    product: "Álbum",
  },
  {
    id: "A",
    orderedAt: "2026-09-02",
    openedAt: "2026-09-01",
    exception: "atraso_entrega",
    status: "aberta",
    brand: "Marca",
    product: "Caneca",
  },
] as RankedOrder[];
const empty = { query: "", exception: "", status: "" };
describe("consulta de pedidos", () => {
  it("ordena pela abertura da exceção, não pela compra, e desempata pelo código", () => {
    expect(orderList(source, empty, false).map((order) => order.id)).toEqual([
      "A",
      "C",
      "B",
    ]);
    expect(source.map((order) => order.id)).toEqual(["B", "C", "A"]);
  });
  it("preserva a prioridade do plano ao filtrar", () => {
    expect(
      orderList(source, { ...empty, exception: "atraso_entrega" }, true).map(
        (order) => order.id,
      ),
    ).toEqual(["B", "A"]);
  });
  it("combina busca sem acentos, status e pendência", () => {
    expect(
      orderList(
        source,
        {
          query: " album ",
          status: "status_divergente",
          exception: "endereco_divergente",
        },
        false,
      ).map((order) => order.id),
    ).toEqual(["C"]);
    expect(
      orderList(source, { ...empty, query: "album", status: "aberta" }, false),
    ).toEqual([]);
  });
  it("padroniza os tamanhos e limita a cem", () => {
    expect(PAGE_SIZES).toEqual([10, 25, 50, 100]);
  });
});
