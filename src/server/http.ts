import { AppError } from "@/application/errors";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSession, getSession } from "@/server/container";
const cookieName = "operations_demo";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function session() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const id = hashToken(token);
    const state = await getSession(id);
    if (state) return { id, state };
  }
  const newToken = randomBytes(32).toString("hex");
  const id = hashToken(newToken);
  const state = await createSession(id);
  jar.set(cookieName, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 86400,
  });
  return { id, state };
}
export async function resetSession() {
  (await cookies()).delete(cookieName);
  return session();
}
export function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new AppError("Origem não permitida.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("Use application/json.", 415);
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof AppError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError)
    return json(
      { error: "Parâmetros inválidos. Revise os campos informados." },
      400,
    );
  const databaseCode = postgresErrorCode(error);
  if (databaseCode === "42P01" || databaseCode === "42703")
    return json(
      {
        error:
          "O banco ainda não está preparado para esta versão. O administrador precisa aplicar as migrações e carregar a base padrão.",
      },
      503,
    );
  if (["28P01", "28000", "3D000"].includes(databaseCode || ""))
    return json(
      {
        error:
          "A conexão com o banco precisa ser revisada pelo administrador. Confira DATABASE_URL no ambiente de produção.",
      },
      503,
    );
  // Não registrar payloads, credenciais, connection strings ou mensagens do provedor.
  console.error("operations_request_failed", {
    type: error instanceof Error ? error.name : "UnknownError",
  });
  return json(
    { error: "Não foi possível concluir a operação. Tente novamente." },
    500,
  );
}

function postgresErrorCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 5; depth++) {
    if (!current || typeof current !== "object") return;
    const entry = current as { code?: unknown; cause?: unknown };
    if (typeof entry.code === "string" && /^[0-9A-Z]{5}$/.test(entry.code))
      return entry.code;
    current = entry.cause;
  }
}
