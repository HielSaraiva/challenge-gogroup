import { exceptionLabels, type RankedOrder } from "@/domain/types";
import { statusLabel } from "./utils";

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export function orderList(
  source: RankedOrder[],
  filters: { query: string; exception: string; status: string },
  preservePlanOrder: boolean,
) {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const query = normalize(filters.query.trim());
  const result = source.filter(
    (order) =>
      (!filters.exception || order.exception === filters.exception) &&
      (!filters.status || order.status === filters.status) &&
      normalize(
        `${order.id} ${order.product} ${exceptionLabels[order.exception]} ${order.brand} ${statusLabel(order.status)}`,
      ).includes(query),
  );
  return preservePlanOrder
    ? result
    : result.sort(
        (a, b) =>
          a.openedAt.localeCompare(b.openedAt) || a.id.localeCompare(b.id),
      );
}
