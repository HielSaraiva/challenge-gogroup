"use client";
import { generatedTextLabel } from "@/lib/utils";
import { Expandable } from "./ui/expandable";
import type { Investigation, ToolEvent } from "@/domain/types";

const toolDescriptions: Record<string, [string, string]> = {
  consultar_recorrencias: [
    "Comparação de recorrências",
    "Comparou os agrupamentos, as amostras e as investigações anteriores.",
  ],
  registrar_analise_recorrencias: [
    "Seleção de investigações",
    "Registrou a seleção justificada do agente e preservou as investigações existentes.",
  ],
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

const stageResults: Record<string, string> = {
  consultar_recorrencias:
    "Agrupamentos e registros anteriores consultados para comparação.",
  registrar_analise_recorrencias:
    "Seleção registrada. Consulte os achados em Recorrências, inclusive quando não houver novas propostas.",
  consultar_diagnostico:
    "Carteira conferida. As alternativas de priorização estão prontas para comparação.",
  comparar_estrategias:
    "Estratégia definida. A seleção está pronta para receber as orientações da equipe.",
  registrar_plano_dia:
    "Plano disponível. Você já pode abrir os pedidos sugeridos e iniciar as tratativas.",
  consultar_pedido:
    "Dossiê conferido. O agente reuniu as evidências para propor o próximo passo.",
  consultar_padroes:
    "Recorrência analisada. As evidências estão disponíveis para orientar a investigação.",
  simular_tratativa:
    "Alternativa avaliada. A estimativa pode apoiar a decisão sobre a tratativa.",
  criar_tarefa:
    "Tarefa disponível no pedido para revisão e execução pela equipe.",
  criar_acao_processo:
    "Investigação aberta para a equipe validar a hipótese e registrar a conclusão.",
};

function eventDescription(event: ToolEvent, type?: Investigation["type"]) {
  if (event.tool === "agente")
    return event.message.replace(
      "Investigação concluída. Ações disponíveis no histórico.",
      type === "daily"
        ? "Preparação concluída. Confira a seleção e as orientações em “Seu plano de trabalho”."
        : type === "pattern"
          ? "Análise concluída. Abra a investigação em Recorrências ou Pendências para conferir a hipótese."
          : "Análise concluída. Confira as tarefas em “Encaminhamentos para este pedido”.",
    );
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
  const current = history.at(-1);
  const success = run?.status === "completed";
  const failed = !busy && run?.status === "failed";
  const quotaExceeded =
    failed && Boolean(run?.summary.match(/Groq.*(?:limite de uso|cota)/i));
  const grouped = new Map<string, ToolEvent>();
  history.forEach((e, i) => grouped.set(e.operationId || `legacy-${i}`, e));
  const calls = [...grouped.entries()];
  const stack = calls
    .filter(
      ([, event]) =>
        event.state !== "running" &&
        (event.tool !== "agente" || event.state === "error"),
    )
    .reverse()
    .sort(([, a], [, b]) => Date.parse(b.at) - Date.parse(a.at));
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
              ? quotaExceeded
                ? "Análise interrompida pelo limite do Groq"
                : "A análise não foi concluída"
              : "Atividade do agente"}
      </h2>
      <p>
        As tentativas aparecem ao terminar, com sucesso ou erro. A mais recente
        fica no topo.
      </p>
      {busy && (
        <p className="agent-current" role="status">
          <span className="agent-working-dot" aria-hidden="true" />
          {current?.state === "running" && current.tool !== "agente"
            ? `${toolDescriptions[current.tool]?.[0] || "Etapa da análise"} em andamento…`
            : "O agente está preparando a próxima etapa…"}
        </p>
      )}
      <ol
        className="agent-completion-stack"
        aria-label="Tentativas finalizadas, da mais recente para a mais antiga"
        aria-live="polite"
        aria-relevant="additions"
      >
        {stack.map(([id, event]) => (
          <li
            key={`${run?.id || "live"}:${id}`}
            className={`agent-completed-step ${event.state === "error" ? "agent-step-error" : ""}`}
          >
            <div className="agent-step-body">
              <header>
                <strong>
                  {toolDescriptions[event.tool]?.[0] || "Etapa da análise"} ·{" "}
                  {event.tool === "agente" && event.state === "error"
                    ? quotaExceeded
                      ? "Limite do Groq atingido"
                      : "Execução interrompida"
                    : event.state === "ok"
                      ? "Concluída"
                      : recovered.has(id)
                        ? "Tentativa corrigida depois"
                        : "Tentativa não concluída"}
                </strong>
                <time dateTime={event.at}>
                  {new Date(event.at).toLocaleTimeString("pt-BR")}
                </time>
              </header>
              <p>
                {event.state === "ok"
                  ? stageResults[event.tool] ||
                    "Etapa concluída. O resultado foi disponibilizado para a próxima ação."
                  : event.tool === "agente"
                    ? quotaExceeded
                      ? "A cota do provedor impediu a continuação. Aguarde a renovação e tente novamente; o trabalho já registrado foi preservado."
                      : "A análise parou antes de terminar. Consulte o motivo nos detalhes técnicos antes de tentar novamente."
                    : recovered.has(id)
                      ? "O agente ajustou esta tentativa e concluiu a etapa depois."
                      : busy
                        ? "Esta tentativa não foi aceita. A análise continua em andamento."
                        : "Esta tentativa não foi registrada. O motivo está disponível nos detalhes técnicos."}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {!busy && !stack.length && (
        <p>Nenhuma etapa foi finalizada nesta execução.</p>
      )}
      {!busy && failed && (
        <p role="alert">
          A análise não foi concluída. Confira acima o ponto de interrupção; se
          já havia um plano ativo, ele continua disponível.
        </p>
      )}
      <Expandable>
        <summary>Detalhes técnicos da execução</summary>
        <>
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
              <article
                className={`agent-event ${e.state === "error" ? "agent-event-error" : ""}`}
                key={id}
              >
                <header className="agent-event-header">
                  <b>
                    {toolDescriptions[e.tool]?.[0] || "Etapa da análise"} ·{" "}
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
                <p>{generatedTextLabel(eventDescription(e, run?.type))}</p>
                {e.state === "error" &&
                  e.message.includes(
                    "Escreva apenas orientação qualitativa",
                  ) && (
                    <Expandable>
                      <summary>O que a validação identificou?</summary>
                      <p>
                        A justificativa incluiu informações numéricas em um
                        campo destinado a orientações. Nesta versão,
                        quantidades, valores e prazos são apresentados em campos
                        separados, calculados pelo servidor. Esta regra valida o
                        formato; não significa que os números gerados estavam
                        incorretos.
                      </p>
                    </Expandable>
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
        </>
      </Expandable>
    </section>
  );
}
