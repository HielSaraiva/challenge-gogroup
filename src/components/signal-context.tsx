import type { Insight } from "@/domain/types";
import { generatedTextLabel } from "@/lib/utils";

export function SignalContext({ pattern }: { pattern: Insight }) {
  return (
    <section
      className="signal-context"
      aria-label="Orientações para conferir o sinal"
    >
      <h3>O que conferir</h3>
      <p>{generatedTextLabel(pattern.investigationQuestion)}</p>
      <p>
        {generatedTextLabel(pattern.title)}. A concentração é um ponto de
        partida; valide os registros e as condições da operação antes de
        concluir a causa.
      </p>
      {pattern.evidenceIds.length > 0 && (
        <p className="signal-references">
          <strong>Pedidos de referência:</strong>{" "}
          {pattern.evidenceIds.slice(0, 3).join(", ")}
        </p>
      )}
    </section>
  );
}
