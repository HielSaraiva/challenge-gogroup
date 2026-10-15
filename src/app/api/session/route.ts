import {
  failure,
  json,
  resetSession,
  session,
  verifyOrigin,
} from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { state } = await session();
    return json({ expiresAt: state.expiresAt });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    await resetSession();
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
