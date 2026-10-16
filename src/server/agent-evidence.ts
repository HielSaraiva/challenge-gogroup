import type { Dataset } from "@/domain/types";
import { AppError } from "./store";
export function requireQualitative(text: string, data: Dataset) {
  let remainder = text.replace(/[\u2010-\u2015]/g, "-");
  const identifiers = [
    ...new Set(
      data.orders
        .flatMap((order) => [
          order.id,
          order.machine,
          order.dc,
          order.lot,
          order.sku,
        ])
        .filter(Boolean),
    ),
  ].sort((a, b) => b.length - a.length);
  for (const id of identifiers) remainder = remainder.split(id).join("");
  if (/\d|%|R\$|€/.test(remainder))
    throw new AppError(
      "Escreva apenas orientação qualitativa, sem valores, datas, quantidades ou porcentagens. O sistema acrescenta os números verificados. Identificadores reais de pedidos, máquinas, CD, lote e SKU podem ser citados.",
    );
}
