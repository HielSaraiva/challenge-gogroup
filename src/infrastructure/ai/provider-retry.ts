import { setTimeout } from "node:timers/promises";

// Retry only explicit short rate-limit waits. Chat completion has no persisted
// application effects; tool effects are executed only after a successful response.
export async function withShortRateLimitRetry<T>(
  call: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const provider = error as {
      status?: number;
      headers?: {
        get?: (key: string) => string | null;
        [key: string]: unknown;
      };
      error?: { message?: string; error?: { message?: string } };
    };
    if (provider.status !== 429 || signal.aborted) throw error;
    const header =
      provider.headers?.get?.("retry-after") ??
      provider.headers?.["retry-after"];
    const message =
      provider.error?.error?.message ?? provider.error?.message ?? "";
    const match = message.match(/try again in\s+(\d+(?:\.\d+)?)s/i);
    const seconds =
      typeof header === "string" && header.trim()
        ? Number(header)
        : match
          ? Number(match[1])
          : NaN;
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 12) throw error;
    await setTimeout(Math.ceil(seconds * 1000) + 250, undefined, { signal });
    signal.throwIfAborted();
    return call();
  }
}
