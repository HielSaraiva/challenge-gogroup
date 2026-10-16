"use client";
import type { Investigation, ToolEvent } from "@/domain/types";

const toolDescriptions: Record<string, [string, string]> = {
  agente: ["Coordenação da análise", "Acompanhamento da execução do agente."],
  consultar_diagnostico: [
    "Diagnóstico da carteira",
    "Consultou os dados da carteira e calculou os indicadores das estratégias disponíveis.",
  ],
  comparar_estrategias: [
    "Comparação de estratégias",
    "Comparou as alternativas e consultou a seleção da estratégia escolhida para preparar os encaminhamentos.",
  ],
  registrar_plano_dia: [
    "Registro do plano do dia",
    "Salvou a seleção de pedidos, a justificativa da estratégia e as orientações para cada área.",
  ],
  consultar_pedido: [
    "Consulta do pedido",
    "Consultou o histórico e as evidências disponíveis no dossiê do pedido.",
  ],
  consultar_padroes: [
    "Consulta de recorrências",
    "Consultou os grupos de pedidos e as evidências de problemas recorrentes.",
  ],
  simular_tratativa: [
    "Avaliação da tratativa",
    "Calculou as estimativas da alternativa proposta, sem executar uma ação externa.",
  ],
  criar_tarefa: [
    "Registro de tarefa",
    "Registrou o encaminhamento para a equipe executar e documentar no pedido.",
  ],
  criar_acao_processo: [
    "Registro de investigação",
    "Registrou uma investigação do grupo afetado, separada da resolução de cada pedido.",
  ],
};

function eventDescription(event: ToolEvent) {
  if (event.tool === "agente") return event.message;
  if (event.state === "running")
    return "Etapa iniciada. Aguardando o retorno da ferramenta.";
  if (event.state === "error") {
    if (event.message.includes("Escreva apenas orientação qualitativa")) {
      return "O registro foi rejeitado porque o texto gerado incluiu números que devem ser acrescentados pelas ferramentas do servidor. Esta tentativa não salvou o encaminhamento.";
    }
    return `A etapa não foi concluída. ${event.message}`;
  }
  return toolDescriptions[event.tool]?.[1] || event.message;
}
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
        <summary>Detalhes técnicos da execução</summary>
        <p>
          Histórico das chamadas do agente, da mais recente para a mais antiga.
          Cada registro mostra o último estado de uma chamada; uma tentativa com
          erro pode ser seguida por outra tentativa.
        </p>
        {[...grouped.entries()]
          .reverse()
          .sort(([, a], [, b]) => Date.parse(b.at) - Date.parse(a.at))
          .map(([id, e]) => (
            <article className="agent-event" key={id}>
              <header className="agent-event-header">
                <b>
                  {toolDescriptions[e.tool]?.[0] || e.tool.replaceAll("_", " ")}{" "}
                  ·{" "}
                  {e.state === "ok"
                    ? "Concluída"
                    : e.state === "error"
                      ? "Falhou"
                      : "Em andamento"}
                </b>
                <time dateTime={e.at}>
                  {new Date(e.at).toLocaleTimeString("pt-BR")}
                </time>
              </header>
              <p>{eventDescription(e)}</p>
              {!e.operationId && (
                <small>Registro legado: sem identificador de chamada.</small>
              )}
            </article>
          ))}
      </details>
    </section>
  );
}
