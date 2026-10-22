import { afterEach, describe, expect, it, vi } from "vitest";
import { withShortRateLimitRetry } from "../../src/infrastructure/ai/provider-retry";
afterEach(() => vi.useRealTimers());
describe("espera curta indicada pelo provedor", () => {
  it("respeita Retry-After e repete uma única vez", async () => {
    vi.useFakeTimers();
    const error = { status: 429, headers: new Headers({ "retry-after": "2" }) };
    const call = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("ok");
    const result = withShortRateLimitRetry(call, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(2249);
    expect(call).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe("ok");
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("aceita espera fracionária explícita da mensagem", async () => {
    vi.useFakeTimers();
    const call = vi
      .fn()
      .mockRejectedValueOnce({
        status: 429,
        error: { message: "Please try again in 1.25s." },
      })
      .mockResolvedValue("ok");
    const result = withShortRateLimitRetry(call, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await result).toBe("ok");
  });
  it("não repete erros sem espera curta ou de outro tipo", async () => {
    for (const error of [
      { status: 429 },
      { status: 429, headers: new Headers({ "retry-after": "60" }) },
      { status: 400 },
    ]) {
      const call = vi.fn().mockRejectedValue(error);
      await expect(
        withShortRateLimitRetry(call, new AbortController().signal),
      ).rejects.toBe(error);
      expect(call).toHaveBeenCalledTimes(1);
    }
  });
  it("o orçamento de abortar continua valendo durante a espera", async () => {
    vi.useFakeTimers();
    const abort = new AbortController();
    const call = vi.fn().mockRejectedValue({
      status: 429,
      headers: new Headers({ "retry-after": "5" }),
    });
    const result = withShortRateLimitRetry(call, abort.signal);
    const assertion = expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(1);
    abort.abort();
    await assertion;
    expect(call).toHaveBeenCalledTimes(1);
  });
  it("não entra em loop se a segunda tentativa também recebe 429", async () => {
    vi.useFakeTimers();
    const error = { status: 429, headers: new Headers({ "retry-after": "0" }) };
    const call = vi.fn().mockRejectedValue(error);
    const result = withShortRateLimitRetry(call, new AbortController().signal);
    const assertion = expect(result).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(250);
    await assertion;
    expect(call).toHaveBeenCalledTimes(2);
  });
});
