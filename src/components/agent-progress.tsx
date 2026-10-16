"use client";
import type { Investigation, ToolEvent } from "@/domain/types";
export function AgentProgress({
  run,
  events,
  busy,
}: {
  run?: Investigation;
  events: ToolEvent[];
  busy: boolean;
}) {
  const history = events.length ? events : run?.events || [];
  if (!history.length && !run) return null;
  const daily =
    run?.type === "daily" ||
    history.some((e) =>
      [
        "consultar_diagnostico",
        "comparar_estrategias",
        "registrar_plano_dia",
      ].includes(e.tool),
    );
  const steps = daily
    ? ([
        ["Conferindo a carteira", ["consultar_diagnostico"]],
        ["Comparando alternativas", ["comparar_estrategias"]],
        ["Preparando encaminhamentos", ["registrar_plano_dia"]],
        ["Salvando o plano", ["registrar_plano_dia"]],
      ] as const)
    : ([
        ["Consultando evidências", ["consultar_pedido", "consultar_padroes"]],
        [
          "Preparando a ação",
          ["simular_tratativa", "criar_tarefa", "criar_acao_processo"],
        ],
        [
          "Registrando o encaminhamento",
          ["criar_tarefa", "criar_acao_processo"],
        ],
      ] as const);
  const success = run?.status === "completed";
  const failed = !busy && run?.status === "failed";
  const grouped = new Map<string, ToolEvent>();
  history.forEach((e, i) => grouped.set(e.operationId || `legacy-${i}`, e));
  return (
    <section className="panel prose" aria-label="Atividade do agente">
      <h2>
        {busy
          ? "O agente está trabalhando"
          : success
            ? "Análise registrada"
            : failed
              ? "A análise não foi concluída"
              : "Atividade do agente"}
      </h2>
      <p>Etapas em ordem, de cima para baixo.</p>
      <ol className="agent-steps" aria-live="polite">
        {steps.map(([label, tools], i) => {
          const matching = history.filter((e) =>
            (tools as readonly string[]).includes(e.tool),
          );
          const last = matching.at(-1);
          const done = success || last?.state === "ok";
          return (
            <li key={label}>
              <b>
                {i + 1}. {label}
              </b>
              <span>
                {done
                  ? "Concluída"
                  : last?.state === "error"
                    ? "Precisa de atenção"
                    : last?.state === "running"
                      ? "Em andamento"
                      : failed
                        ? "Não concluída"
                        : "Aguardando"}
              </span>
            </li>
          );
        })}
      </ol>
      {!busy && <p role={failed ? "alert" : undefined}>{run?.summary}</p>}
      <details>
        <summary>Detalhes técnicos</summary>
        {[...grouped.entries()].map(([id, e]) => (
          <p key={id}>
            <b>
              {e.tool.replaceAll("_", " ")} · {e.state}
            </b>
            <br />
            {e.message} · {new Date(e.at).toLocaleTimeString("pt-BR")}
            {!e.operationId ? " · registro legado" : ""}
          </p>
        ))}
      </details>
    </section>
  );
}
