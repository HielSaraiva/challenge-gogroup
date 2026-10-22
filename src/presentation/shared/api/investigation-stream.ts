import type { Investigation, ToolEvent } from "@/domain/types";

type InvestigationFrame = {
  event?: ToolEvent;
  investigation?: Investigation;
  error?: string;
};

/** Decode NDJSON independently of network chunk boundaries, including split UTF-8. */
export async function* readInvestigationStream(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<InvestigationFrame> {
  if (!body) throw new Error("Não foi possível ler a resposta da análise.");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      if (done && buffer.trim()) lines.push(buffer);
      for (const line of lines.filter((line) => line.trim())) {
        const payload: InvestigationFrame = JSON.parse(line);
        if (payload.error) throw new Error(payload.error);
        yield payload;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
