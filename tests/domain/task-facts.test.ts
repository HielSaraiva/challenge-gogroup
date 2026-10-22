import { describe, expect, it } from "vitest";
import {
  taskFactLabel,
  generatedTextLabel,
  insightGroupLabel,
} from "../../src/shared/formatting";

describe("fatos de tarefas salvas anteriormente", () => {
  it("traduz identificadores de status persistidos no texto", () => {
    expect(taskFactLabel("Status: em_analise.")).toBe("Status: Em análise.");
    expect(taskFactLabel("Status: aguardando_transportadora.")).toBe(
      "Status: Aguardando transportadora.",
    );
  });
  it("preserva fatos já formatados e outras evidências", () => {
    expect(taskFactLabel("Status: Em análise.")).toBe("Status: Em análise.");
    expect(
      taskFactLabel("Referência: REF_em_analise_123 no sistema externo."),
    ).toBe("Referência: REF_em_analise_123 no sistema externo.");
  });
});

describe("identificadores nos textos gerados", () => {
  it("traduz apenas códigos conhecidos e preserva IDs compostos", () => {
    expect(
      generatedTextLabel(
        "criar_tarefa: revisao_cadastral; endereco_divergente; PROMISE_MISMATCH.",
      ),
    ).toBe(
      "Registro de tarefa: Revisão cadastral; Endereço divergente; Divergência no prazo prometido.",
    );
    expect(
      generatedTextLabel("REF_em_analise_123 · GB7010799 · lote_XYZ"),
    ).toBe("REF_em_analise_123 · GB7010799 · lote_XYZ");
  });
  it("apresenta grupos booleanos atuais e fatos antigos com legenda", () => {
    expect(insightGroupLabel("true")).toBe("Com brinde");
    expect(insightGroupLabel("false")).toBe("Sem brinde");
    expect(insightGroupLabel("CD-SP|manhã")).toBe("CD-SP / manhã");
    expect(taskFactLabel("Registros do grupo true.")).toBe(
      "Registros do grupo Com brinde.",
    );
  });
});
