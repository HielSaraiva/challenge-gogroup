export function paginationItems(
  current: number,
  total: number,
): (number | "ellipsis")[] {
  const count = Math.max(1, Math.floor(total));
  const page = Math.max(1, Math.min(count, Math.floor(current)));
  if (count <= 7) return Array.from({ length: count }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis", count];
  if (page >= count - 3)
    return [1, "ellipsis", count - 4, count - 3, count - 2, count - 1, count];
  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", count];
}

export function paginate<T>(
  items: T[],
  requestedPage: number,
  pageSize: number,
) {
  const size = Math.max(1, Math.min(100, Math.floor(pageSize) || 10));
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.max(
    1,
    Math.min(totalPages, Math.floor(requestedPage) || 1),
  );
  return {
    page,
    totalPages,
    total: items.length,
    start: items.length ? (page - 1) * size + 1 : 0,
    end: Math.min(page * size, items.length),
    items: items.slice((page - 1) * size, page * size),
  };
}
