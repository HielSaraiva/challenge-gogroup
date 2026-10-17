import type { Insight } from "@/domain/types";
import { generatedTextLabel, insightGroupLabel } from "@/lib/utils";

export function SignalContext({ pattern }: { pattern: Insight }) {
  return (
    <section className="signal-context" aria-label="Sinal observado na base">
      <h3>Sinal observado na base</h3>
      <p>{generatedTextLabel(pattern.title)}</p>
      <p>
        <strong>Grupo:</strong> {insightGroupLabel(pattern.group)}
      </p>
      <p>
        <strong>{pattern.count.toLocaleString("pt-BR")}</strong> casos
        relacionados
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
