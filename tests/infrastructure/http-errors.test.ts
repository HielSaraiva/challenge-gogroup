import { describe, expect, it } from "vitest";
import { failure } from "../../src/server/http";

describe("diagnóstico seguro do banco de produção", () => {
  it("identifica tabelas ausentes sem expor a consulta ou a conexão", async () => {
    const response = failure(
      new Error("consulta privada", {
        cause: { code: "42P01", message: "postgresql://segredo" },
      }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("migrações");
    expect(JSON.stringify(body)).not.toContain("segredo");
    expect(JSON.stringify(body)).not.toContain("consulta privada");
  });
  it("identifica credenciais inválidas sem imprimir a senha", async () => {
    const response = failure({ code: "28P01", message: "senha privada" });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("DATABASE_URL");
    expect(body.error).not.toContain("senha privada");
  });
});
