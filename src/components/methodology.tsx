"use client";
import { useEffect, useState, type MouseEvent } from "react";
import { ChevronDown, List } from "lucide-react";
import { STRATEGIES, type Weights } from "@/domain/types";
import type { dashboard } from "@/domain/analytics";
const sections = [
  ["method-flow", "Do diagnóstico ao resultado"],
  ["method-agent", "Papel da IA"],
  ["method-priority", "Priorização"],
  ["method-outcomes", "Execução e resultados"],
  ["method-data", "Dados e tecnologia"],
  ["method-pilot", "Limites e validação"],
] as const;
export function Methodology({
  summary,
  weights,
}: {
  summary?: ReturnType<typeof dashboard>;
  weights: Weights;
}) {
  const [indexOpen, setIndexOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("method-flow");
  function scrollToSection(animate = false) {
    const id = window.location.hash.slice(1);
    if (!id.startsWith("method-")) return;
    const section = document.getElementById(id);
    if (!section) return;
    setActiveSection(id);
    const title = section.querySelector<HTMLElement>("h2");
    if (title) {
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    }
    section.scrollIntoView({
      block: "start",
      behavior:
        animate &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "instant",
    });
  }
  useEffect(() => {
    let frame = 0;
    const restoreSection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => scrollToSection());
    };
    restoreSection();
    window.addEventListener("hashchange", restoreSection);
    window.addEventListener("popstate", restoreSection);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", restoreSection);
      window.removeEventListener("popstate", restoreSection);
    };
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );
    for (const [id] of sections) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);
  function followSection(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    setIndexOpen(false);
    const hash = event.currentTarget.hash;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
    scrollToSection(true);
  }
  return (
    <div className="methodology">
      <aside className="method-sidebar">
        <p className="method-index-title">Nesta metodologia</p>
        <button
          className="method-index-toggle"
          type="button"
          aria-expanded={indexOpen}
          aria-controls="method-section-links"
          onClick={() => setIndexOpen(!indexOpen)}
        >
          <List size={18} aria-hidden="true" /> Nesta metodologia{" "}
          <ChevronDown size={18} aria-hidden="true" />
        </button>
        <nav
          className={`method-index ${indexOpen ? "is-open" : ""}`}
          id="method-section-links"
          aria-label="Nesta metodologia"
        >
          {sections.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={followSection}
              aria-current={activeSection === id ? "location" : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>
      <div className="method-content">
        <section className="panel prose" id="method-flow">
          <h2>Do diagnóstico ao resultado</h2>
          <ol className="workflow-steps">
            <li>
              <b>Dados:</b> importe os três CSVs da mesma extração e confira a
              prévia.
            </li>
            <li>
              <b>Hoje:</b> peça para a IA preparar o dia. O agente consulta a
              carteira, compara estratégias e registra um plano com orientações.
            </li>
            <li>
              <b>Pedidos:</b> siga a sugestão, confira os fatos e investigue o
              pedido com IA. A investigação cria uma tarefa persistida.
            </li>
            <li>
              <b>Execução:</b> revise propostas, aprove quando necessário e
              registre a ação e a evidência. Só então informe o resultado do
              pedido.
            </li>
            <li>
              <b>Resultados:</b> acompanhe casos resolvidos, pendências,
              reembolsos e custos registrados.
            </li>
            <li>
              <b>Melhorias:</b> investigue recorrências separadamente. Uma
              conclusão sobre o processo não encerra os pedidos relacionados.
            </li>
          </ol>
          <p>
            Este piloto usa dados sintéticos e não executa ações externas. A
            equipe confirma o que realizou; o agente não inventa comprovantes.
          </p>
        </section>

        <section className="panel prose" id="method-agent">
          <h2>Por que o agente é parte do trabalho?</h2>
          <p>
            Você escolhe o foco do plano: equilíbrio, urgência ou
            relacionamento. A IA compara as alternativas calculadas, aplica a
            estratégia escolhida e explica seus efeitos. Depois consulta
            amostras da seleção e registra por onde começar em cada área, com
            motivo e próximo passo. O servidor calcula números e verifica os
            vínculos, inclusive se a estratégia aplicada corresponde à escolha
            do usuário.
          </p>
          <details open>
            <summary>O que cada execução produz?</summary>
            <ul>
              <li>
                <b>Plano diário:</b> estratégia, justificativa, pedidos
                selecionados, comparação com FIFO e orientações para todas as
                áreas. O agente consulta amostras; não investigou
                individualmente todos os pedidos.
              </li>
              <li>
                <b>Pedido:</b> encaminhamento interno com evidências,
                responsável por área e prazo. A proposta de reenvio ou reembolso
                exige simulação do custo antes de ser registrada.
              </li>
              <li>
                <b>Recorrência:</b> hipótese, evidências de pedidos relacionados
                e verificação de campo. A equipe registra se a hipótese foi
                confirmada, descartada ou permanece inconclusiva.
              </li>
            </ul>
          </details>
          <details>
            <summary>
              Por que as ferramentas e os registros são necessários?
            </summary>
            <p>
              Um texto dizendo “plano pronto” não conclui uma execução. É
              obrigatório consultar o diagnóstico e comparar estratégias antes
              de registrar o plano. Consultar o pedido é obrigatório antes de
              criar tarefa. O servidor rejeita IDs, áreas e evidências
              inválidos.
            </p>
            <p>
              Groq é o provedor de inferência, com credencial apenas no
              servidor. Evidências selecionadas são enviadas a ele na
              investigação. Não exibimos raciocínio interno: mostramos fatos
              consultados, decisões registradas e efeitos persistidos.
            </p>
            <p>
              Há limites de seis rodadas, doze ferramentas e duas tarefas por
              investigação, além de tempo, uso diário e controle de
              concorrência. Idempotência evita duplicação. Falha ou erro 429
              preserva os efeitos registrados, mostra o problema e não gera uma
              resposta simulada de sucesso.
            </p>
          </details>
          <details>
            <summary>Como ler a atividade do agente?</summary>
            <p>
              As tentativas entram na pilha ao terminar, com sucesso ou erro e a
              mais recente no topo e o horário da conclusão. Um indicador
              separado acompanha o trabalho em andamento. Preparar os
              encaminhamentos e salvar o plano aparecem como um único registro,
              pois são concluídos pela mesma ferramenta. As chamadas de
              ferramentas ficam em detalhes técnicos, agrupadas por
              identificador de chamada; registros antigos sem esse identificador
              são marcados como legados.
            </p>
          </details>
        </section>
        <section className="panel prose" id="method-priority">
          <h2>Por que estes pedidos foram selecionados?</h2>
          <p>
            Capacidade fornecida: 150 tratativas por dia para toda a equipe, com
            12 minutos em média por tratativa. Antes de cada geração, o usuário
            escolhe entre três estratégias iniciais. Os pesos são heurísticas
            deste projeto; não são política oficial nem uma previsão de
            recuperação financeira.
          </p>
          <table>
            <thead>
              <tr>
                <th>Estratégia</th>
                <th>Valor</th>
                <th>Urgência</th>
                <th>Relacionamento</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(STRATEGIES).map(([key, s]) => (
                <tr key={key}>
                  <td>{s.label}</td>
                  <td>{s.weights.value}%</td>
                  <td>{s.weights.urgency}%</td>
                  <td>{s.weights.relationship}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Pesos do plano ativo: {weights.value}/{weights.urgency}/
            {weights.relationship}. O operador recebe motivos concretos para
            agir; não precisa interpretar porcentagens normalizadas para usar a
            ferramenta.
          </p>
          <details>
            <summary>Fórmulas e escolha da normalização</summary>
            <p>
              Pontuação = 100 × soma de cada componente normalizado multiplicado
              por seu peso ÷ soma dos pesos. Empates seguem abertura mais antiga
              e depois identificador. Cada componente fica limitado a 1.
            </p>
            <ul>
              <li>
                <b>Valor:</b> valor do pedido dividido pelo percentil 95 dos
                valores da base.
              </li>
              <li>
                <b>Urgência:</b> maior número entre dias úteis de atraso e idade
                da exceção, dividido pelo percentil 95 dessa medida na base. O
                percentil substitui o teto antigo de dez dias, que saturava
                muitos pedidos e escondia diferenças de espera.
              </li>
              <li>
                <b>Relacionamento:</b> ticket médio histórico × probabilidade de
                recompra × 50% de redução por exceção mal resolvida, dividido
                pelo percentil 95 dessa medida. Usa 70% de recompra para receita
                acumulada acima de R$ 1.500 e 28% nos demais casos.
              </li>
            </ul>
            <p>
              É uma aproximação por pedido. Não somamos o componente de
              relacionamento para alegar perda futura da carteira, pois um
              cliente pode ter várias exceções.
            </p>
          </details>
          <details>
            <summary>
              Reserva para antigos, capacidade e comparação com FIFO
            </summary>
            <p>
              Reservamos 20% das vagas restantes aos casos mais antigos,
              arredondando para cima. Isso reduz adiamento contínuo de pedidos
              de menor valor. As demais vagas seguem a pontuação da estratégia
              escolhida. A proporção é uma escolha do piloto e precisa ser
              validada com a equipe.
            </p>
            <p>
              Na demonstração, um encerramento consome uma vaga; reabrir não
              devolve esforço. Este contador não mede contatos, investigações ou
              tempo real. Ações de melhoria precisam de esforço dimensionado à
              parte. Produção exige capacidade por especialidade e registro de
              esforço.
            </p>
            <p>
              O plano e a comparação com FIFO são fotografias salvas da mesma
              base, na mesma capacidade. Encerrar um caso atualiza o progresso,
              sem colocar outro pedido silenciosamente. Para outra seleção,
              prepare novo plano. Mudança da base, revisão de status ou política
              antiga exige revisão; o histórico é preservado.
            </p>
            <p>
              Maior valor coberto não demonstra recuperação, produtividade nem
              efeito causal. O agente compara valor, exposição e espera, sem
              prometer que uma única métrica represente sucesso.
            </p>
          </details>
          <details>
            <summary>Calendário e promessa ao cliente</summary>
            <p>
              A referência é fixa: 30/09/2026. Sábados, domingos e os feriados
              nacionais de 07/09 e 12/10 não contam como dias úteis. O primeiro
              dia útil após o pedido é o dia de separação; depois contam-se os
              dias do SLA da transportadora por UF.
            </p>
            <p>
              A promessa original é preservada para calcular o atraso perante o
              cliente. O contrato calculado aparece ao lado para verificar
              divergências. Para entregues, o atraso termina na entrega. Uma
              entrega não encerra automaticamente exceções como item faltante ou
              avaria.
            </p>
          </details>
        </section>
        <section className="panel prose" id="method-outcomes">
          <h2>Por que aprovação, execução e resultado são separados?</h2>
          <p>
            Aprovar um reenvio autoriza a ação; não comprova que o item foi
            enviado. A equipe precisa registrar a execução e sua evidência.
            Depois, o encerramento exige resultado compatível com a exceção e
            ausência de tarefas pendentes. Revisar um status, sozinho, não
            resolve a pendência original.
          </p>
          <details open>
            <summary>Quando há resultado sem dinheiro?</summary>
            <p>
              Exemplo sintético: um pedido está bloqueado por endereço
              divergente. O operador confirma o endereço, registra a referência
              e encerra essa exceção como “endereço corrigido”. Não houve
              reembolso, e o efeito financeiro pode não ter sido mensurado. Isso
              é um resultado operacional útil.
            </p>
            <p>
              Em reembolso, são obrigatórios valor positivo, limitado ao pedido,
              e evidência. Custos podem ser estimados ou informados pelo
              operador. Valor desconhecido permanece “não informado”; não é
              convertido em zero.
            </p>
          </details>
          <details>
            <summary>Significado de cada valor</summary>
            <ul>
              <li>
                <b>Valor de carteira:</b> soma dos pedidos, sem duplicatas; não
                é prejuízo.
              </li>
              <li>
                <b>Exposição:</b> valor × probabilidade de cancelamento, somente
                para logística ainda não entregue. Atraso de 1–2 dias úteis: 4%;
                3–5: 10%; 6–10: 22%; mais de 10: 40%. Sem atraso: zero. Não
                extrapolamos esses parâmetros para outras exceções.
              </li>
              <li>
                <b>Reenvio ou reprodução estimada:</b> 24% do valor do pedido +
                frete médio contratado. Para item faltante, o pedido integral é
                uma aproximação, pois não há preço por item.
              </li>
              <li>
                <b>Reembolso estimado:</b> valor pago pelo cliente. Contato: R$
                9, sem atribuir todo o histórico anual a uma exceção.
              </li>
              <li>
                <b>Volume tratado:</b> valor dos pedidos resolvidos, sem alegar
                receita preservada.
              </li>
              <li>
                <b>Reembolsos e custos registrados:</b> declarações do operador,
                com custos estimados separados dos informados. Não calculamos
                saldo entre receita, reembolso e custo como se fosse lucro.
              </li>
            </ul>
            <p>
              O simulador genérico de eficácia foi retirado porque não havia
              medida que sustentasse aquela porcentagem. A estimativa permanece
              junto da proposta concreta, para apoiar a avaliação antes da
              execução.
            </p>
          </details>
          <details>
            <summary>
              Por que uma investigação de melhoria não encerra pedidos?
            </summary>
            <p>
              Exemplo sintético: uma amostra sugere problema de embalagem em um
              lote. A equipe confere pedidos e registros de campo, documenta a
              conclusão e encaminha inspeção. Isso conclui o diagnóstico; os
              clientes continuam precisando de tratativas individuais.
            </p>
            <p>
              Finalizar a investigação exige conclusão, observações, referências
              de ao menos dois pedidos relacionados e próximo encaminhamento.
              Não basta abrir um pedido ou clicar em concluir. Uma hipótese
              confirmada pelo operador não comprova implantação ou eficácia da
              melhoria.
            </p>
            <p>
              Usamos dimensões pertinentes à etapa. Sinais precisam de ao menos
              dez casos; a triagem de processo usa participação mínima de 15% e
              associação relativa de 1,5 vez a participação na base elegível.
              São heurísticas sem teste de significância. A divergência de prazo
              segue verificação contratual própria. Sem todas as vendas ou
              produção, não há taxa real de falha nem causalidade demonstrada.
            </p>
          </details>
        </section>
        <section className="panel prose" id="method-data">
          <h2>Por que esta arquitetura e esta entrada de dados?</h2>
          {summary && (
            <p>
              Base atual: {summary.sourceRows} linhas, {summary.totalCount}{" "}
              pedidos únicos. Conflitos de status e promessas divergentes são
              preservados para revisão.
            </p>
          )}
          <details open>
            <summary>CSV no piloto; integração no uso interno</summary>
            <p>
              A importação valida campos, relações e duplicatas; exibe prévia e
              só grava com confirmação. Status conflitantes não são resolvidos
              automaticamente porque falta timestamp da origem. Outros conflitos
              do mesmo pedido bloqueiam a carga. A data fixa impede importar
              eventos posteriores à referência sem revisar a política.
            </p>
            <p>
              A carga pela interface é exclusiva da sessão. Trocar a base com
              tratativas ativas é bloqueado. Reiniciar em Dados cria nova sessão
              sem tratativas e preserva a base escolhida. Os arquivos e
              credenciais ficam fora do Git.
            </p>
            <p>
              Para o dia a dia interno, a atualização automática é recomendada
              depois de mapear ERP, atendimento e logística. São necessários
              responsáveis, IDs estáveis, atualização de status, carga
              incremental, conciliação, monitoramento e reprocessamento. Não
              presumimos quais serviços a Gogroup usa.
            </p>
          </details>
          <details>
            <summary>Escolhas técnicas e seus limites</summary>
            <ul>
              <li>
                <b>Next.js, React e TypeScript:</b> interface e endpoints no
                mesmo projeto, com contratos tipados e domínio separado da
                interface e do modelo.
              </li>
              <li>
                <b>Zod:</b> validação no servidor de entradas, evidências e
                transições. A interface não é a única barreira.
              </li>
              <li>
                <b>Decimal.js:</b> evita imprecisão de ponto flutuante em
                valores monetários.
              </li>
              <li>
                <b>Groq com ferramentas:</b> IA aplica a estratégia escolhida e
                encaminhamentos, enquanto cálculos e efeitos são controlados
                pelo servidor.
              </li>
              <li>
                <b>Neon PostgreSQL e Drizzle:</b> persistência hospedada,
                versões e atualizações atômicas. Arquivos .local são alternativa
                de desenvolvimento em uma instância.
              </li>
              <li>
                <b>JSON versionado:</b> novos planos registram estratégia, base
                e comparação. Registros antigos são legados, sem evidências
                fabricadas.
              </li>
              <li>
                <b>Radix UI e fontes locais:</b> diálogos com gestão de foco,
                identidade visual consistente e menor dependência de fontes
                externas.
              </li>
            </ul>
            <p>
              Tarefas individuais têm prazo de um dia útil; investigações de
              melhoria, dois após a referência. São escolhas a homologar por
              área. Sessões independentes por cookie expiram em sete dias.
              Acesso expirado não representa uma política de descarte auditada
              para produção.
            </p>
          </details>
        </section>
        <section className="panel prose" id="method-pilot">
          <h2>O que falta provar no piloto?</h2>
          <p>
            Observe se um operador novo consegue preparar o dia, entender a
            sugestão, registrar a execução e encerrar com resultado sem ajuda.
            Compare com FIFO usando capacidade e carteiras equivalentes. Meça
            tempo de triagem, pedidos tratados por hora, espera, reaberturas,
            tarefas aceitas sem correção e sucesso do agente com efeito
            persistido.
          </p>
          <p>
            Para produção interna faltam autenticação, papéis, atribuição por
            pessoa, fila compartilhada, histórico durável, calendário
            atualizado, integrações e capacidade medida por esforço. Também
            devem ser homologados acesso, retenção e envio de dados ao provedor
            de IA.
          </p>
          <p>
            Resultados financeiros precisam de conciliação com pagamentos,
            retenções e custos externos. Sem isso, não alegamos receita
            recuperada, lucro ou retorno incremental. Defina metas e período com
            a equipe antes de concluir eficácia.
          </p>
        </section>
      </div>
    </div>
  );
}
