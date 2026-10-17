import { describe, expect, it } from "vitest";
import { paginationItems } from "@/lib/pagination";

describe("paginação compacta de pedidos", () => {
  it("mostra todas as páginas de uma seleção pequena", () => {
    expect(paginationItems(2, 4)).toEqual([1, 2, 3, 4]);
  });
  it("mostra início e acesso direto ao fim", () => {
    expect(paginationItems(1, 134)).toEqual([1, 2, 3, 4, 5, "ellipsis", 134]);
  });
  it("mostra a página atual e as vizinhas sem listar toda a carteira", () => {
    expect(paginationItems(70, 134)).toEqual([
      1,
      "ellipsis",
      69,
      70,
      71,
      "ellipsis",
      134,
    ]);
  });
  it("mostra o fim e preserva acesso à primeira página", () => {
    expect(paginationItems(134, 134)).toEqual([
      1,
      "ellipsis",
      130,
      131,
      132,
      133,
      134,
    ]);
  });
  it("mantém uma página para uma busca vazia", () => {
    expect(paginationItems(1, 0)).toEqual([1]);
  });
});
