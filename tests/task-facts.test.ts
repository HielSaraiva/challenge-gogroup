import { describe, expect, it } from "vitest";
import { taskFactLabel } from "@/lib/utils";

describe("fatos de tarefas salvas anteriormente", () => {
  it("traduz identificadores de status persistidos no texto", () => {
    expect(taskFactLabel("Status: em_analise.")).toBe("Status: Em análise.");
    expect(taskFactLabel("Status: aguardando_transportadora.")).toBe(
      "Status: Aguardando transportadora.",
    );
  });
  it("preserva fatos já formatados e outras evidências", () => {
    expect(taskFactLabel("Status: Em análise.")).toBe("Status: Em análise.");
    expect(taskFactLabel("Referência: em_analise no sistema externo.")).toBe(
      "Referência: em_analise no sistema externo.",
    );
  });
});
