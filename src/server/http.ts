import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  AppError,
  createSession,
  getSession,
  saveSessionDataset,
} from "./store";
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
  const previous = await session();
  (await cookies()).delete(cookieName);
  const next = await session();
  if (previous.state.importedDataset)
    await saveSessionDataset(next.id, previous.state.importedDataset);
  return next;
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
  // Não registrar payloads, credenciais, connection strings ou mensagens do provedor.
  console.error("operations_request_failed", {
    type: error instanceof Error ? error.name : "UnknownError",
  });
  return json(
    { error: "Não foi possível concluir a operação. Tente novamente." },
    500,
  );
}
