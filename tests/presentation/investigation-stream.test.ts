import { describe, expect, it } from "vitest";
import { readInvestigationStream } from "../../src/presentation/shared/api/investigation-stream";

function stream(text: string, size = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += size)
        controller.enqueue(bytes.slice(offset, offset + size));
      controller.close();
    },
  });
}
async function frames(body: ReadableStream<Uint8Array> | null) {
  const results = [];
  for await (const frame of readInvestigationStream(body)) results.push(frame);
  return results;
}
describe("investigation response stream", () => {
  it("preserves UTF-8 and completed results across arbitrary chunk boundaries", async () => {
    const event = {
      tool: "consulta",
      message: "Análise da operação",
      state: "ok",
    };
    const investigation = {
      id: "saved",
      status: "completed",
      taskIds: ["task"],
    };
    const body = stream(
      JSON.stringify({ event }) +
        "\r\n\n" +
        JSON.stringify({ investigation }) +
        "\n",
    );
    expect(await frames(body)).toEqual([{ event }, { investigation }]);
    expect(body.locked).toBe(false);
  });
  it("reads the final record when the connection closes without a trailing newline", async () => {
    expect(
      await frames(stream('{"investigation":{"status":"completed"}}', 20)),
    ).toEqual([{ investigation: { status: "completed" } }]);
  });
  it("propagates real agent errors and releases the reader", async () => {
    const body = stream('{"error":"Limite atingido"}\n');
    await expect(frames(body)).rejects.toThrow("Limite atingido");
    expect(body.locked).toBe(false);
  });
  it("does not interpret a malformed response as success", async () => {
    await expect(frames(stream('{"investigation":'))).rejects.toBeInstanceOf(
      SyntaxError,
    );
  });
  it("handles a missing response body explicitly", async () => {
    await expect(frames(null)).rejects.toThrow(
      "Não foi possível ler a resposta da análise.",
    );
  });
});
