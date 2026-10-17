import { readFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { importDataset } from "../src/domain/import";

async function main() {
  const connection = process.env.DATABASE_URL;
  if (!connection)
    throw new Error(
      "Configure DATABASE_URL em .env.local ou no ambiente antes de preparar o banco.",
    );
  const schemaOnly = process.argv.includes("--schema-only");
  const directory = schemaOnly ? undefined : process.argv[2];
  // Validate the private source before touching the remote database.
  const data = directory
    ? await Promise.all(
        ["pedidos_excecao.csv", "clientes.csv", "transportadoras.csv"].map(
          (file) => readFile(path.resolve(directory, file), "utf8"),
        ),
      ).then(([orders, customers, carriers]) =>
        importDataset({ orders, customers, carriers }),
      )
    : undefined;
  const sql = neon(connection);
  await migrate(drizzle(sql), { migrationsFolder: path.resolve("drizzle") });
  console.log("Migrações aplicadas. Tabelas de produção disponíveis.");
  if (schemaOnly) return;
  if (data) {
    // Seed once: running setup again never overwrites an existing source dataset.
    await sql`INSERT INTO datasets (id, payload) VALUES ('operations', ${JSON.stringify(data)}::jsonb) ON CONFLICT (id) DO NOTHING`;
  }
  const [source] = await sql`SELECT id FROM datasets WHERE id = 'operations'`;
  if (!source)
    throw new Error(
      "Tabelas prontas, mas a base padrão ainda não foi carregada. Execute pnpm db:prepare com o diretório privado dos três CSVs.",
    );
  console.log(
    "Base padrão disponível. Preparação concluída, sem alterar sessões existentes.",
  );
}

main().catch((error: unknown) => {
  // Never print database exceptions: they can contain SQL, payloads and credentials.
  console.error(
    error instanceof Error &&
      (error.message.startsWith("Configure DATABASE_URL") ||
        error.message.startsWith("Tabelas prontas"))
      ? error.message
      : "Não foi possível preparar o banco. Confira a conexão, as permissões e os CSVs. Se as tabelas foram criadas com db:push, revise o histórico de migrações antes de continuar.",
  );
  process.exitCode = 1;
});
