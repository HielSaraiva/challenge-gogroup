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
    if (
      event.message.startsWith("Use exatamente uma orientação para cada área")
    ) {
      return "O plano não foi salvo nesta tentativa porque as orientações ou os destaques não correspondiam às áreas da seleção. Este registro antigo não informa qual área faltou, foi repetida ou era inválida.";
    }
    if (event.message.includes("Escreva apenas orientação qualitativa")) {
      return event.tool === "registrar_plano_dia"
        ? "Esta versão do plano não foi salva: a resposta da IA não passou pela validação do formato das orientações. Não é necessário corrigir os arquivos importados por causa desta rejeição."
        : "Esta tentativa não foi registrada: a resposta da IA não passou pela validação do formato das orientações.";
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
  const calls = [...grouped.entries()];
  const recovered = new Set(
    calls
      .filter(
        ([, event], index) =>
          event.state === "error" &&
          [
            "consultar_diagnostico",
            "comparar_estrategias",
            "registrar_plano_dia",
          ].includes(event.tool) &&
          calls
            .slice(index + 1)
            .some(
              ([, later]) => later.tool === event.tool && later.state === "ok",
            ),
      )
      .map(([id]) => id),
  );
  return (
    <section className="panel prose" aria-label="Atividade do agente">
      <h2>
        {busy
          ? "O agente está trabalhando"
          : success
            ? run?.type === "daily"
              ? "Preparação do plano concluída"
              : run?.type === "order"
                ? `Análise do pedido ${run.target} concluída`
                : "Análise da recorrência concluída"
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
        <div className="agent-technical-content">
          <p>
            Histórico das chamadas do agente, da mais recente para a mais
            antiga. Tentativas não concluídas ficam registradas mesmo quando o
            agente corrige o conteúdo e consegue concluir a etapa depois.
          </p>
          {recovered.size > 0 && (
            <p>
              O agente corrigiu uma tentativa anterior e concluiu a etapa em
              seguida. O resultado válido é o registro concluído mais recente.
            </p>
          )}
          {calls
            .reverse()
            .sort(([, a], [, b]) => Date.parse(b.at) - Date.parse(a.at))
            .map(([id, e]) => (
              <article className="agent-event" key={id}>
                <header className="agent-event-header">
                  <b>
                    {toolDescriptions[e.tool]?.[0] ||
                      e.tool.replaceAll("_", " ")}{" "}
                    ·{" "}
                    {e.state === "ok"
                      ? "Concluída"
                      : e.state === "error"
                        ? recovered.has(id)
                          ? "Tentativa corrigida depois"
                          : e.tool === "agente" && failed
                            ? "Análise interrompida"
                            : "Tentativa não concluída"
                        : "Em andamento"}
                  </b>
                  <time dateTime={e.at}>
                    {new Date(e.at).toLocaleTimeString("pt-BR")}
                  </time>
                </header>
                <p>{eventDescription(e)}</p>
                {e.state === "error" &&
                  e.message.includes(
                    "Escreva apenas orientação qualitativa",
                  ) && (
                    <details>
                      <summary>O que a validação identificou?</summary>
                      <p>
                        A justificativa incluiu informações numéricas em um
                        campo destinado a orientações. Nesta versão,
                        quantidades, valores e prazos são apresentados em campos
                        separados, calculados pelo servidor. Esta regra valida o
                        formato; não significa que os números gerados estavam
                        incorretos.
                      </p>
                    </details>
                  )}
                {recovered.has(id) && (
                  <p>
                    Depois dessa rejeição, o agente fez uma nova tentativa da
                    mesma etapa e conseguiu concluí-la.
                  </p>
                )}
                {e.state === "error" &&
                  e.tool !== "agente" &&
                  !recovered.has(id) && (
                    <p>
                      {busy
                        ? "A análise continua em andamento. Esta tentativa ainda não teve uma correção concluída."
                        : failed
                          ? "A execução terminou sem concluir esta etapa. Para tentar novamente, inicie outra análise."
                          : "Esta tentativa não foi concluída. Consulte o resultado final da análise para verificar o que foi registrado."}
                    </p>
                  )}
                {!e.operationId && (
                  <small>Registro legado: sem identificador de chamada.</small>
                )}
              </article>
            ))}
        </div>
      </details>
    </section>
  );
}
