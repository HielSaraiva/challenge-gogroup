import { readFile } from "node:fs/promises";
import path from "node:path";
import { importDataset } from "../src/domain/import";
import { saveDataset } from "../src/server/store";
import { dashboard, queue } from "../src/domain/analytics";
async function main() {
const directory = process.argv[2];
if (!directory) throw new Error('Uso: pnpm import:data "caminho/privado/dos/csvs"');
const [orders, customers, carriers] = await Promise.all(["pedidos_excecao.csv", "clientes.csv", "transportadoras.csv"].map(file => readFile(path.resolve(directory, file), "utf8")));
const data = importDataset({ orders, customers, carriers });
await saveDataset(data);
console.log(JSON.stringify({ imported: data.orders.length, sourceRows: data.sourceRows, dashboard: dashboard(data), comparison: { prioritized: queue(data).prioritized, fifo: queue(data).fifo } }, null, 2));
}
main().catch(error => { console.error(error instanceof Error && error.name === "ZodError" ? "CSV inválido. Revise os campos no dicionário." : "Importação falhou. Verifique arquivos, banco e configuração."); process.exitCode = 1; });
