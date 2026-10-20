import { data as fixture } from "../browser/fixtures";
import type { Dataset } from "../../src/domain/types";

/** Public, fabricated workload with many distinct and overlapping groupings. */
export const recurrenceWorkload: Dataset = {
  ...fixture,
  sourceRows: 2000,
  orders: Array.from({ length: 2000 }, (_, i) => {
    const block = Math.floor(i / 250);
    return {
      ...fixture.orders[0],
      id: `LOAD-${i}`,
      exception: [
        "atraso_entrega",
        "item_faltante",
        "falha_personalizacao",
        "vazamento_produto",
        "extravio",
        "avaria_transporte",
        "ruptura_pos_venda",
        "endereco_divergente",
      ][block],
      carrier: `Transporte sintético ${block}`,
      state: ["SP", "CE", "PE", "BA", "RJ", "MG", "RS", "RN"][block],
      shift: `Turno sintético ${block}`,
      machine: `MAQ-${block}`,
      dc: `CD-${block}`,
      lot: `LOTE-${block}`,
      gift: block === 1,
    };
  }),
};
