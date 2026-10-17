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
