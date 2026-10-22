import { describe, expect, it } from "vitest";
import { paginationItems, paginate } from "../../src/shared/pagination";

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

describe("paginação de listas operacionais", () => {
  it("limita a última página quando o último item é concluído", () => {
    const before = paginate(
      Array.from({ length: 11 }, (_, i) => i),
      2,
      10,
    );
    expect(before.items).toEqual([10]);
    const after = paginate(
      Array.from({ length: 10 }, (_, i) => i),
      2,
      10,
    );
    expect(after.page).toBe(1);
    expect(after.items).toHaveLength(10);
  });
  it("não perde itens entre páginas e mantém limites de tamanho", () => {
    const rows = Array.from({ length: 27 }, (_, i) => i);
    expect([1, 2, 3].flatMap((page) => paginate(rows, page, 10).items)).toEqual(
      rows,
    );
    expect(paginate(rows, 100, 1000).page).toBe(1);
    expect(paginate([], 5, 10)).toMatchObject({
      page: 1,
      totalPages: 1,
      start: 0,
      end: 0,
      items: [],
    });
  });
});
