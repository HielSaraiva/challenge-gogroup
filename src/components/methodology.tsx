"use client";
import { Expandable } from "./ui/expandable";
import { useEffect, useState, type MouseEvent } from "react";
import { ChevronDown, List } from "lucide-react";
import { STRATEGIES, type Weights } from "@/domain/types";
import type { dashboard } from "@/domain/analytics";
const sections = [
  ["method-flow", "Do diagnóstico ao resultado"],
  ["method-agent", "Papel da IA"],
  ["method-priority", "Priorização"],
  ["method-outcomes", "Execução e resultados"],
  ["method-recurrences", "Recorrências"],
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
          <p>
            A central apoia a operação da Gocase e da GoBeauté em duas frentes:
            tratar pedidos com problemas e investigar ocorrências que se
            repetem. O objetivo é usar a capacidade da equipe com critério e
            acompanhar soluções comprovadas, sem confundir estimativas com
            dinheiro recuperado.
          </p>
          <ol className="workflow-steps">
            <li>
              <b>Dados:</b> confira a base disponível. Para usar outra base,
              valide e importe os três CSVs da mesma extração.
            </li>
            <li>
              <b>Hoje:</b> escolha o foco e prepare um plano com IA para a
              capacidade disponível. Esta etapa é opcional: você pode investigar
              um pedido diretamente em Pedidos.
            </li>
            <li>
              <b>Pedidos:</b> consulte toda a carteira ou a seleção do plano.
              Abra uma linha, confira os fatos e investigue com IA para obter um
              encaminhamento. Se houver conflito de status, valide a fonte antes
              de continuar.
            </li>
            <li>
              <b>Pendências:</b> acompanhe tratativas iniciadas, propostas,
              reenvios aguardando recebimento e pedidos aguardando resultado.
              Investigações de recorrência abertas também aparecem aqui.
            </li>
            <li>
              <b>Resultados:</b> veja o resumo de pedidos abertos, resolvidos e
              reabertos, os tipos de solução e os valores registrados. Para
              consultar um pedido específico, use Pedidos.
            </li>
            <li>
              <b>Recorrências:</b> solicite a análise da base com IA, confira as
              investigações propostas pelo agente e registre a conclusão da
              equipe. Essa investigação não encerra os pedidos relacionados.
            </li>
          </ol>
          <p>
            Esta demonstração usa dados sintéticos. A IA registra planos e
            encaminhamentos; a equipe executa as ações fora da aplicação e
            documenta as evidências. Não há envio de produtos, mensagens ou
            pagamentos por esta ferramenta.
          </p>
        </section>
        <section className="panel prose" id="method-agent">
          <h2>O que a IA faz e o que cabe à equipe?</h2>
          <p>
            O sistema calcula prioridades, prazos, custos indicativos e sinais
            de recorrência. O agente consulta esses dados e registra um
            encaminhamento com hipótese, área responsável e próximo passo. A
            equipe confere os fatos, aprova propostas quando necessário e
            confirma o resultado real.
          </p>
          <Expandable open>
            <summary>O que cada análise entrega?</summary>
            <ul>
              <li>
                <b>Plano do dia:</b> aplica o foco escolhido por você, compara
                estratégias e registra a seleção de pedidos e orientações por
                área. O agente consulta amostras; o plano não cria tarefas para
                todos os pedidos selecionados.
              </li>
              <li>
                <b>Pedido:</b> consulta o caso e cria uma tarefa compatível com
                o problema. Propostas de reenvio e reembolso exigem simulação de
                valor e aprovação humana antes da execução.
              </li>
              <li>
                <b>Recorrência:</b> compara agrupamentos e investigações
                anteriores, seleciona até três achados e cria títulos, hipóteses
                e verificações recomendadas. Pode não propor novos achados. A
                conclusão depende das verificações documentadas pela equipe.
              </li>
            </ul>
          </Expandable>
          <p>
            Para preparar o dia, o servidor reúne os indicadores e as amostras
            antes da chamada ao modelo. A IA compara as alternativas e registra
            as orientações em uma resposta. Os cálculos e a seleção continuam
            validados pelo servidor.
          </p>
          <Expandable>
            <summary>Repetir uma análise usa a IA novamente?</summary>
            <p>
              Abrir pedidos ou investigações já registradas não usa a IA.
              Investigar um pedido novamente ou preparar outro plano faz uma
              nova chamada e exige confirmação quando já existe análise ou
              plano.
            </p>
            <p>
              Em Recorrências, analisar a base novamente usa a IA e exige
              confirmação quando já há análises concluídas ou investigações.
              Abrir uma investigação existente não gera outra. Após registrar a
              conclusão, você também pode solicitar outra investigação daquele
              grupo com confirmação. A conclusão anterior é preservada e pode
              ser consultada a partir da nova investigação.
            </p>
          </Expandable>
          <Expandable>
            <summary>Como acompanhar a atividade do agente?</summary>
            <p>
              A atividade mostra as etapas em andamento e as tentativas
              finalizadas, da mais recente para a mais antiga. “Análise
              concluída” significa que o agente registrou seu encaminhamento;
              não que o pedido foi resolvido ou que a causa foi comprovada.
            </p>
            <p>
              As tarefas ficam no pedido e as investigações de recorrência ficam
              em Recorrências e, enquanto abertas, em Pendências. “Histórico
              deste caso” reúne validações de status, encerramentos e
              reaberturas; não é a lista de chamadas da IA.
            </p>
          </Expandable>
          <Expandable>
            <summary>Validação, falhas e limites de uso</summary>
            <p>
              Um texto de sucesso não basta: o servidor exige consultas e um
              plano ou tarefa salvo, além de validar áreas, referências e
              compatibilidade com o pedido. Repetir a mesma ação não deve criar
              tarefas duplicadas.
            </p>
            <p>
              Há limites de tempo, chamadas e uso diário. Uma falha preserva o
              que já foi registrado e não produz sucesso simulado. Confira os
              registros antes de tentar novamente. O Groq processa as evidências
              selecionadas; a credencial fica apenas no servidor. Os detalhes
              técnicos mostram chamadas e resultados, não raciocínio interno do
              modelo.
            </p>
          </Expandable>
        </section>
        <section className="panel prose" id="method-priority">
          <h2>Como os pedidos são priorizados?</h2>
          <p>
            A capacidade de referência é de 150 tratativas por dia para toda a
            equipe, com média de 12 minutos por tratativa. Antes de preparar o
            plano, você escolhe o foco. Os pesos abaixo são escolhas deste
            piloto, não uma política oficial ou previsão de recuperação
            financeira.
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
            Pesos usados como referência nesta tela: valor {weights.value}%,
            urgência {weights.urgency}% e relacionamento {weights.relationship}
            %. Com um plano disponível, são os pesos dele; sem plano, são os
            padrões.
          </p>
          <Expandable>
            <summary>Como a pontuação é calculada?</summary>
            <p>
              Pontuação = 100 × soma dos componentes normalizados multiplicados
              por seus pesos ÷ soma dos pesos. Cada componente é limitado a 1.
              Empates seguem abertura mais antiga e depois código do pedido.
            </p>
            <ul>
              <li>
                <b>Valor:</b> valor do pedido dividido pelo percentil 95 dos
                valores da base.
              </li>
              <li>
                <b>Urgência:</b> maior número entre dias úteis de atraso e idade
                da exceção, dividido pelo percentil 95 dessa medida na base.
              </li>
              <li>
                <b>Relacionamento:</b> valor médio das compras do cliente ×
                probabilidade de recompra × redução de 50% por exceção mal
                resolvida, normalizado pelo percentil 95. Usa 70% de recompra
                para receita acumulada acima de R$ 1.500 e 28% nos demais casos.
              </li>
            </ul>
            <p>
              O componente de relacionamento é uma aproximação por pedido. Não
              representa receita futura comprovada nem deve ser somado como
              perda de toda a carteira.
            </p>
          </Expandable>
          <Expandable>
            <summary>Capacidade, pedidos antigos e ordem de chegada</summary>
            <p>
              Reservamos 20% das vagas restantes aos casos mais antigos,
              arredondando para cima. As demais vagas seguem a pontuação. Isso
              reduz o adiamento de pedidos de menor valor.
            </p>
            <p>
              Na demonstração, cada encerramento consome uma vaga. Reabrir não
              devolve a vaga, pois houve trabalho realizado. O contador não mede
              contatos, investigações ou tempo real; investigações de
              recorrência precisam de dimensionamento separado.
            </p>
            <p>
              O plano é comparado com FIFO, isto é, atender pela ordem de
              abertura, usando a mesma base e capacidade. Encerrar um caso
              atualiza o progresso sem repor pedidos automaticamente. Outra
              seleção exige um novo plano. Revisões de status ou mudanças na
              base podem exigir sua atualização.
            </p>
            <p>
              Sem plano, Pedidos mostra a carteira por abertura mais antiga, com
              desempate pelo código. Com plano, a seleção segue a prioridade
              calculada. Os filtros preservam a ordem da lista consultada.
            </p>
          </Expandable>
          <Expandable>
            <summary>Prazos e data de referência</summary>
            <p>
              Os cálculos usam 30/09/2026, não a data de hoje. Sábados, domingos
              e os feriados nacionais de 07/09 e 12/10 não contam como dias
              úteis. O primeiro dia útil após o pedido é o de separação; depois
              contam-se os dias contratados com a transportadora por UF.
            </p>
            <p>
              A promessa original mede o atraso percebido pelo cliente. O prazo
              calculado pelo contrato aparece ao lado para conferir
              divergências. Para pedidos entregues, o atraso termina na entrega,
              mas a exceção pode continuar aberta, como no caso de item
              faltante.
            </p>
          </Expandable>
        </section>
        <section className="panel prose" id="method-outcomes">
          <h2>Da execução ao encerramento</h2>
          <p>
            Aprovar uma proposta autoriza a ação; não envia um produto nem
            movimenta dinheiro. Para encerrar um pedido, é preciso uma tarefa
            executada e documentada, um resultado compatível com o problema e
            nenhuma tarefa pendente na etapa atual. Validar o status, sozinho,
            não resolve a exceção.
          </p>
          <Expandable open>
            <summary>Como registrar sem repetir informações?</summary>
            <p>
              Informe a ação e sua evidência na execução. Se o problema já foi
              resolvido, confirme o resultado no mesmo formulário. Você pode
              reutilizar a evidência quando ela também comprovar a solução.
            </p>
            <p>
              Se ainda faltar confirmação, salve apenas a execução. O pedido
              continua aberto em Pendências. Depois, registre o resultado sem
              descrever a ação novamente e acrescente apenas a evidência que
              faltar.
            </p>
          </Expandable>
          <Expandable>
            <summary>Reenvio, rejeição e revisão de status</summary>
            <p>
              Após aprovar o reenvio, registre o despacho. O pedido fica aberto
              até a confirmação de recebimento e de resolução do problema. A
              prova do despacho não serve como confirmação de recebimento.
            </p>
            <p>
              Uma proposta rejeitada exige motivo e mantém o pedido em
              acompanhamento para outro encaminhamento. A validação de status
              conclui a tarefa de revisão, mas ainda é necessário tratar a
              exceção original.
            </p>
          </Expandable>
          <Expandable>
            <summary>O que acontece ao reabrir?</summary>
            <p>
              O pedido sai de resolvidos, volta aos abertos e aparece em
              Pendências aguardando nova investigação. “Reabertos” é parte dos
              abertos, não um total adicional. O novo encerramento exige
              investigação e execução da nova etapa.
            </p>
            <p>
              Encerramentos e reaberturas permanecem no histórico do caso.
              Reembolsos e custos informados anteriormente continuam nos totais;
              a reabertura não desfaz esses valores. Registre somente novos
              valores na nova etapa.
            </p>
          </Expandable>
          <Expandable>
            <summary>Como ler o dashboard de Resultados?</summary>
            <ul>
              <li>
                <b>Resumo:</b> situação atual dos pedidos. O percentual
                resolvido é a quantidade resolvida dividida pelo total da base.
              </li>
              <li>
                <b>Valores registrados:</b> reembolsos e custos informados
                acumulados, inclusive após reabertura. Estimativas são previsões
                registradas nos encerramentos atuais e ficam separadas.
              </li>
              <li>
                <b>Problemas em aberto:</b> quantidade de pedidos ainda não
                resolvidos por tipo de exceção.
              </li>
              <li>
                <b>Soluções registradas:</b> tipos de resultado dos pedidos
                atualmente resolvidos. Só aparecem categorias com registros.
              </li>
            </ul>
            <p>
              Os detalhes individuais ficam em Pedidos. Os registros são
              declarados pela equipe e não são conciliados automaticamente com
              sistemas de pagamento ou logística.
            </p>
          </Expandable>
          <Expandable>
            <summary>Valor em risco, estimativas e despesas</summary>
            <ul>
              <li>
                <b>Valor da carteira:</b> soma dos valores dos pedidos únicos;
                não representa prejuízo ou receita recuperada.
              </li>
              <li>
                <b>Exposição estimada:</b> valor × probabilidade de
                cancelamento, apenas para exceções logísticas ainda não
                entregues. Para atrasos de 1–2 dias úteis: 4%; 3–5: 10%; 6–10:
                22%; mais de 10: 40%. Sem atraso: zero.
              </li>
              <li>
                <b>Reenvio ou reprodução:</b> estimativa de 24% do valor do
                pedido mais frete médio contratado. Para item faltante, é uma
                aproximação: a base não informa o preço de cada item.
              </li>
              <li>
                <b>Reembolso:</b> valor efetivo informado com evidência. A soma
                de reembolsos de todas as etapas não pode superar o valor do
                pedido.
              </li>
              <li>
                <b>Custo da tratativa:</b> despesa adicional, como novo frete ou
                reprodução. Não inclui o pedido original nem o reembolso. Marque
                se é previsão ou custo realizado informado pela equipe.
              </li>
            </ul>
            <p>
              Deixe custos desconhecidos em branco; informe zero apenas quando
              não houve custo. Resolver um endereço, por exemplo, pode produzir
              um resultado operacional sem reembolso. Não calculamos lucro ou
              receita recuperada a partir desses registros.
            </p>
          </Expandable>
        </section>
        <section className="panel prose" id="method-recurrences">
          <h2>Como investigar recorrências?</h2>
          <p>
            Tratar um pedido resolve um caso. Investigar uma recorrência busca
            entender por que o mesmo problema aparece em vários pedidos e qual
            processo merece revisão.
          </p>
          <ol className="workflow-steps">
            <li>
              <b>Análise da base:</b> clique em “Analisar recorrências com IA”.
              O sistema calcula agrupamentos e indicadores; o agente compara as
              evidências e as investigações anteriores.
            </li>
            <li>
              <b>Seleção do agente:</b> a IA escolhe até três achados por
              análise e cria os cards com título, hipótese e verificação
              recomendada. Quantidades e referências vêm do sistema. Se não
              houver novos achados suficientes, a análise explica isso sem criar
              cards artificiais.
            </li>
            <li>
              <b>Verificação da equipe:</b> abra uma investigação, confira ao
              menos dois pedidos e as condições reais da operação. Registre as
              evidências e a conclusão sobre a hipótese. A recomendação seguinte
              é opcional. Use a busca e a paginação para localizar pedidos; as
              referências do agente aparecem primeiro. “Salvar progresso” guarda
              anotações e pedidos conferidos sem concluir a investigação. Ao
              retomar, continue do último salvamento. “Registrar conclusão”
              exige ao menos dois pedidos, resultado e observações. Se ainda
              faltam verificações, salve o progresso em vez de encerrar como
              inconclusiva.
            </li>
            <li>
              <b>Continuidade:</b> a conclusão sai de Pendências e continua
              acessível em Recorrências. Uma nova análise geral considera o que
              já foi registrado, prioriza agrupamentos menos examinados e não
              recria automaticamente grupos existentes. Para retomar um grupo
              concluído, use “Investigar este grupo novamente”.
            </li>
          </ol>
          <p>
            Por exemplo, uma falha de personalização pode exigir conferir
            impressora e turno na Gocase; uma falta de item pode exigir conferir
            separação e brinde; um vazamento pode exigir investigar o lote. São
            caminhos de investigação, não causas comprovadas.
          </p>
          <Expandable>
            <summary>Quais dados o agente recebe?</summary>
            <p>
              Usamos grupos pertinentes à etapa do problema. A triagem comum
              exige ao menos dez casos, participação mínima de 15% e associação
              relativa de 1,5 vez a participação na base elegível. A divergência
              entre promessa e contrato tem uma verificação própria.
            </p>
            <p>
              Para limitar o uso da cota, cada análise compara até dezesseis
              agrupamentos de maior relevância, com amostras de até três pedidos
              e os registros anteriores relacionados. O agente pode propor até
              três investigações ou justificar que não há novos achados. O
              servidor valida as referências e evita grupos quase idênticos.
            </p>
            <p>
              São critérios exploratórios, sem teste de significância. A
              quantidade de exceções de uma transportadora não diz sua taxa de
              falha: faltam todas as entregas para comparação. Concentração não
              demonstra causa.
            </p>
          </Expandable>
          <p>
            Concluir a investigação não encerra os pedidos, implanta uma mudança
            ou comprova sua eficácia. A aplicação registra diagnóstico e
            encaminhamento; a execução da melhoria precisa de acompanhamento
            fora deste piloto.
          </p>
        </section>
        <section className="panel prose" id="method-data">
          <h2>Dados e tecnologia</h2>
          {summary && (
            <p>
              Base atual: {summary.sourceRows.toLocaleString("pt-BR")} linhas de
              origem e {summary.totalCount.toLocaleString("pt-BR")} pedidos
              únicos.
            </p>
          )}
          <Expandable open>
            <summary>Importação e conferência dos dados</summary>
            <p>
              Use os CSVs de pedidos com exceção, clientes e transportadoras da
              mesma extração. A prévia confere campos, relações e duplicatas; a
              base muda apenas depois da confirmação. Linhas repetidas são
              consolidadas para não contar o mesmo pedido mais de uma vez.
            </p>
            <p>
              Status conflitantes são preservados para revisão humana, pois a
              origem não informa qual é o mais recente. Outros conflitos no
              mesmo pedido bloqueiam a carga. Promessas divergentes são
              sinalizadas, sem substituir a data original.
            </p>
            <p>
              A importação pela interface vale apenas para sua sessão. Trocar a
              base com tratativas ativas é bloqueado. Reiniciar em Dados cria
              uma nova sessão sem tratativas e restaura a base padrão de
              30/09/2026.
            </p>
          </Expandable>
          <Expandable>
            <summary>Persistência, acesso e integrações</summary>
            <p>
              O piloto usa Next.js, React e TypeScript, com validação no
              servidor, cálculos monetários em Decimal.js, IA pelo Groq e
              persistência em Neon PostgreSQL com Drizzle. Armazenamento em
              arquivos é alternativa apenas para desenvolvimento local.
            </p>
            <p>
              Cada visitante tem uma sessão independente, identificada por
              cookie, com acesso por sete dias. A sessão não é uma fila
              compartilhada. Expiração de acesso não deve ser confundida com uma
              política homologada de retenção e descarte para produção.
            </p>
            <p>
              A atualização de dados é manual. Para uso diário na Gocase e na
              GoBeauté, é preciso mapear os sistemas de pedidos, atendimento,
              estoque, produção e logística, definir responsáveis e integrar
              atualizações com conciliação, monitoramento e reprocessamento.
            </p>
          </Expandable>
          <Expandable>
            <summary>Premissas do piloto</summary>
            <p>
              A data operacional é fixa em 30/09/2026; eventos posteriores são
              bloqueados na importação. Tarefas individuais recebem prazo de um
              dia útil após essa referência; investigações de recorrência, dois.
              Esses prazos são escolhas do projeto a validar por área.
            </p>
            <p>
              Os dados são sintéticos e devem ser tratados com cuidado.
              Investigar com IA envia evidências selecionadas ao provedor.
              Arquivos de origem e credenciais não fazem parte do repositório.
            </p>
          </Expandable>
        </section>
        <section className="panel prose" id="method-pilot">
          <h2>Limites e validação</h2>
          <p>
            O piloto demonstra priorização, investigação e registro de
            encaminhamentos. Para avaliar sua utilidade, observe operadores
            executando o fluxo e meça tempo de triagem, espera, pedidos
            tratados, reaberturas e encaminhamentos aceitos sem correção.
            Compare com ordem de chegada usando capacidade e carteiras
            equivalentes.
          </p>
          <p>
            Para operação interna, ainda são necessários autenticação, papéis,
            atribuição por pessoa, fila compartilhada, calendário atualizado,
            integrações e capacidade medida pelo esforço real. Acesso, retenção
            de dados e envio ao provedor de IA precisam ser homologados.
          </p>
          <p>
            Resultados financeiros exigem conciliação com pagamentos e custos
            externos. Sem essa confirmação e uma comparação adequada, os
            indicadores não comprovam lucro, receita recuperada ou benefício
            incremental da solução.
          </p>
        </section>
      </div>
    </div>
  );
}
