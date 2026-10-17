"use client";
import { Button } from "./button";
import { paginationItems } from "@/lib/pagination";

export function Pagination({
  page,
  totalPages,
  total,
  start,
  end,
  noun,
  pageSize,
  sizes = [10, 25, 50, 100],
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  noun: string;
  pageSize: number;
  sizes?: number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  if (!total) return null;
  return (
    <div className="pagination list-pagination">
      <span aria-live="polite">
        {start}–{end} de {total} {noun} · página {page} de {totalPages}
      </span>
      <label className="page-size-control">
        Itens por página
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      {totalPages > 1 && (
        <nav className="pagination-numbers" aria-label={`Páginas de ${noun}`}>
          {paginationItems(page, totalPages).map((item, index) =>
            item === "ellipsis" ? (
              <span
                className="pagination-gap"
                key={`gap-${index}`}
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                variant="outline"
                aria-label={`Página ${item}`}
                aria-current={page === item ? "page" : undefined}
                onClick={() => onPage(item)}
              >
                {item}
              </Button>
            ),
          )}
        </nav>
      )}
    </div>
  );
}
