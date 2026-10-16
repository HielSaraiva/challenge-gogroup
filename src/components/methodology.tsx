"use client";
import { Button } from "./ui/button";
import { DEFAULT_WEIGHTS } from "@/domain/types";
import type { Weights } from "@/domain/types";
import type { dashboard } from "@/domain/analytics";
type Props = {
  summary?: ReturnType<typeof dashboard>;
  weights: Weights;
  onReset: () => void;
};
export function Methodology({ summary, weights, onReset }: Props) {
  const total = weights.value + weights.urgency + weights.relationship;
  return (
    <div className="methodology">
      <section className="panel prose">
        <h2>Como trabalhar com o Go Operations</h2>
        <p>
          Uma ferramenta de apoio para decidir quais exceções tratar, investigar
          evidências e acompanhar encaminhamentos. Este ambiente é uma
          demonstração para validar o fluxo com a equipe; ainda não executa
          ações nos sistemas da Gogroup.
        </p>
        <ol className="workflow-steps">
          <li>
            <b>Prepare a base.</b> Confira a origem e importe os três CSVs em
            Dados.
          </li>
          <li>
            <b>Comece por Hoje.</b> Confira a capacidade e abra a fila. O plano
            da IA é um apoio opcional para organizar as áreas.
          </li>
          <li>
            <b>Trate um pedido.</b> Revise os fatos, resolva conflitos de status
            e peça uma investigação à IA.
          </li>
          <li>
            <b>Registre a execução.</b> Revise a tarefa, aprove propostas quando
            necessário e confirme o que foi realizado. Só então encerre a
            exceção com justificativa.
          </li>
          <li>
            <b>Aprenda com a operação.</b> Investigue padrões em Processos e
            acompanhe os resultados em Impacto.
          </li>
        </ol>
      </section>
      <nav className="method-index" aria-label="Nesta metodologia">
        <a href="#method-priority">Priorização</a>
        <a href="#method-business">Regras de negócio</a>
        <a href="#method-agent">IA e decisões humanas</a>
        <a href="#method-data">Dados e arquitetura</a>
        <a href="#method-pilot">Validação do piloto</a>
      </nav>
      <section className="panel prose" id="method-priority">
        <h2>Por que estes pedidos entram na fila?</h2>
        <p>
          A equipe tem capacidade de referência de 150 tratativas por dia, com
          12 minutos em média por tratativa. A seleção combina valor do pedido,
          urgência e relacionamento. Ela pode ser consultada mesmo quando a IA
          está indisponível.
        </p>
        <p>
          <b>Política escolhida pelo projeto:</b> pesos padrão de{" "}
          {DEFAULT_WEIGHTS.value}% para valor, {DEFAULT_WEIGHTS.urgency}% para
          urgência e {DEFAULT_WEIGHTS.relationship}% para relacionamento. Não
          são uma política oficial da Gogroup nem um modelo de retorno validado.
          Os pesos ativos são {Math.round((weights.value / total) * 100)}%,{" "}
          {Math.round((weights.urgency / total) * 100)}% e{" "}
          {Math.round((weights.relationship / total) * 100)}%, respectivamente.
        </p>
        <p>
          Reservamos 20% das vagas restantes para os pedidos mais antigos,
          arredondando para cima. As demais vagas seguem a pontuação; empates
          usam abertura mais antiga e depois identificador. A reserva evita que
          pedidos de menor valor sejam sempre adiados. Sua proporção precisa ser
          avaliada no piloto.
        </p>
        <details>
          <summary>Ver fórmula, normalização e exemplo</summary>
          <p>
            Pontuação = 100 × (valor normalizado × peso de valor + urgência
            normalizada × peso de urgência + relacionamento normalizado × peso
            de relacionamento) ÷ soma dos pesos.
          </p>
          <ul>
            <li>
              <b>Valor:</b> valor do pedido ÷ percentil 95 dos valores da base,
              limitado a 1. Isso reduz a influência de valores extremos.
            </li>
            <li>
              <b>Urgência:</b> maior número entre dias úteis de atraso e idade
              da exceção ÷ 10, limitado a 1. Para entregues, o atraso termina na
              entrega.
            </li>
            <li>
              <b>Relacionamento:</b> ticket médio histórico × probabilidade de
              recompra × 50%, normalizado pelo percentil 95 da mesma medida e
              limitado a 1. Acima de R$ 1.500 de receita acumulada usamos 70%;
              nos demais, 28%.
            </li>
          </ul>
          <p>
            Exemplo sintético: componentes 0,8, 0,6 e 0,5, com os pesos padrão,
            resultam em 67 pontos. A pontuação serve para ordenar; não significa
            67% de chance de resolver ou de recuperar receita.
          </p>
          <p>
            A medida de relacionamento é uma aproximação por pedido. Não deve
            ser somada como perda futura da carteira, pois um cliente pode ter
            várias exceções.
          </p>
        </details>
        <details>
          <summary>O que o contador de capacidade realmente mede?</summary>
          <p>
            Na demonstração, cada encerramento consome uma vaga. Reabrir não
            devolve o esforço já contabilizado; um novo encerramento consome
            outra vaga. Isso é uma aproximação, pois investigar e contatar
            também consome tempo. Ações de processo não entram automaticamente
            nas 150 vagas. Em produção, será necessário registrar esforço por
            tratativa e capacidade por especialidade.
          </p>
          <p>
            A comparação com ordem de chegada (FIFO) usa a mesma quantidade de
            vagas e a mesma carteira pendente. Mais valor coberto não demonstra
            mais recuperação financeira.
          </p>
        </details>
      </section>
      <section className="panel prose" id="method-business">
        <h2>Regras de negócio e significado dos números</h2>
        <p>
          Os parâmetros fornecidos são a base dos cálculos. Escolhas adicionais
          do projeto estão identificadas como aproximações ou heurísticas.
        </p>
        <details open>
          <summary>Calendário, promessa e pedidos entregues</summary>
          <p>
            A referência do case é 30/09/2026, e não a data do computador.
            Finais de semana e os feriados nacionais de 07/09 e 12/10 são
            excluídos. O primeiro dia útil após o pedido é o dia de separação;
            depois contam-se os dias úteis do SLA contratado por transportadora
            e UF.
          </p>
          <p>
            A promessa original continua sendo usada para o atraso perante o
            cliente. O prazo calculado pelo contrato aparece ao lado para
            identificar divergências, sem alterar a promessa. Entrega registrada
            não encerra uma exceção: ainda pode haver item faltante, avaria ou
            outra pendência.
          </p>
        </details>
        <details>
          <summary>Carteira, exposição, custos e resultado</summary>
          <ul>
            <li>
              <b>Carteira:</b> soma dos valores dos pedidos pendentes, sem
              contar duplicatas. Não é prejuízo.
            </li>
            <li>
              <b>Exposição a cancelamento:</b> valor × probabilidade, somente
              para exceções logísticas sem entrega registrada. Atrasos de 1–2
              dias úteis usam 4%; 3–5, 10%; 6–10, 22%; acima de 10, 40%. Sem
              atraso a exposição calculada é zero. Não extrapolamos essa tabela
              para pagamentos, produção ou outras exceções.
            </li>
            <li>
              <b>Reenvio ou reprodução:</b> 24% do valor do pedido + frete médio
              contratado. Para item faltante, o reenvio integral é uma
              aproximação porque não há preço por item.
            </li>
            <li>
              <b>Reembolso:</b> valor pago pelo cliente. Contato: R$ 9 por
              contato; o histórico anual não é custo atribuível automaticamente
              àquela exceção.
            </li>
            <li>
              <b>Benefício simulado:</b> exposição elegível × eficácia
              informada, descontando o custo informado. As premissas não
              comprovam resultado.
            </li>
            <li>
              <b>Resultado declarado:</b> valor preservado ou reembolsado
              informado pelo operador, com evidência e limitado ao valor do
              pedido. Fica separado de recuperação comprovada por sistemas
              externos.
            </li>
          </ul>
          <p>
            Criar uma tarefa, aprovar uma proposta ou encerrar uma exceção não
            gera receita recuperada. Sem confirmação externa, não alegamos
            retorno financeiro comprovado.
          </p>
        </details>
      </section>
      <section className="panel prose" id="method-agent">
        <h2>O que a IA faz, e o que cabe à equipe?</h2>
        <p>
          A IA consulta fatos e usa ferramentas restritas para registrar planos,
          tarefas e hipóteses de melhoria. Os cálculos monetários, a pontuação e
          as validações ficam no servidor para serem reproduzíveis. O texto da
          IA precisa de revisão humana.
        </p>
        <details open>
          <summary>Três ações úteis do agente</summary>
          <ul>
            <li>
              <b>Plano do dia:</b> consulta a seleção e uma amostra por área,
              escolhe um primeiro pedido válido e registra motivo e próximo
              passo. Não investiga toda a carteira nem cria tarefas em lote.
            </li>
            <li>
              <b>Investigação de pedido:</b> consulta o dossiê e registra tarefa
              com área responsável, prazo e evidências. Propostas financeiras
              exigem simulação prévia.
            </li>
            <li>
              <b>Investigação de processo:</b> consulta um padrão e registra uma
              hipótese com amostra e próxima verificação. Concluir essa ação não
              encerra os pedidos relacionados.
            </li>
          </ul>
        </details>
        <details>
          <summary>Aprovação, execução, falhas e limites</summary>
          <p>
            Status conflitantes exigem revisão antes de outros encaminhamentos.
            Propostas passam por aprovação humana; depois, a equipe registra a
            execução. Aprovação sozinha não resolve o pedido. O encerramento
            exige tarefa concluída, ausência de pendências e justificativa.
          </p>
          <p>
            O agente usa até seis rodadas, doze ferramentas e duas tarefas por
            investigação, além de limites de tempo e uso diário. O servidor
            verifica consulta prévia, escopo e evidências. Idempotência evita
            duplicação da mesma ação; controle de concorrência protege a sessão.
            Falhas preservam o histórico e os efeitos já gravados.
          </p>
          <p>
            Tarefas individuais recebem prazo de um dia útil; ações de processo,
            dois dias úteis após a referência. Esses prazos são escolhas do
            protótipo, a validar por área. Nenhuma mensagem, pagamento,
            reembolso ou pedido de reenvio é executado externamente.
          </p>
        </details>
        <details>
          <summary>Por que padrões não são causas comprovadas?</summary>
          <p>
            Usamos dimensões relacionadas à etapa operacional. Sinais de
            concentração exigem pelo menos dez casos; o encaminhamento para
            processo usa participação de pelo menos 15% na exceção e associação
            relativa de pelo menos 1,5 vez a participação na base elegível. São
            limiares heurísticos, sem teste de significância. Divergência de
            promessa segue a verificação contratual própria.
          </p>
          <p>
            A base contém exceções, sem o total de vendas ou produção por
            transportadora, CD, máquina ou lote. Portanto, não permite calcular
            taxas reais de falha nem atribuir causalidade. A ação deve buscar
            evidências de campo antes de alterar o processo.
          </p>
        </details>
      </section>
      <section className="panel prose" id="method-data">
        <h2>Dados, tecnologia e limites do ambiente</h2>
        {summary ? (
          <p>
            Na base atual: {summary.sourceRows} registros consolidados em{" "}
            {summary.totalCount} pedidos. Há {summary.conflicts} pedidos
            pendentes com conflito de status e {summary.promiseMismatches}{" "}
            promessas divergentes entre os pedidos pendentes.
          </p>
        ) : (
          <p>
            Importe a base em Dados para consultar os indicadores de qualidade.
          </p>
        )}
        <details open>
          <summary>Importação e futura integração</summary>
          <p>
            CSV é a entrada do piloto: prévia, validação de campos e
            relacionamentos, consolidação de duplicatas e confirmação. Conflitos
            de status são preservados porque não há timestamp para escolher o
            mais recente. Outros conflitos no mesmo pedido bloqueiam a carga.
          </p>
          <p>
            Uma importação pela interface pertence à sessão e não altera a base
            dos demais visitantes. Trocar a base com histórico ativo é bloqueado
            para não misturar decisões. Reiniciar limpa as tratativas e preserva
            a base escolhida.
          </p>
          <p>
            Para operação diária, recomendamos integração automática após mapear
            ERP, atendimento e logística. São necessários contrato de dados,
            identificadores estáveis, atualização incremental, histórico de
            status, conciliação, monitoramento e tratamento de falhas. Não há
            evidência de quais serviços a empresa usa; não simulamos uma conexão
            inexistente.
          </p>
        </details>
        <details>
          <summary>Por que esta arquitetura?</summary>
          <ul>
            <li>
              <b>Next.js, React e TypeScript:</b> interface e endpoints no mesmo
              projeto, com contratos tipados. Regras de domínio ficam separadas
              para poder testá-las sem a interface ou a IA.
            </li>
            <li>
              <b>Zod e validação no servidor:</b> rejeitam entradas e transições
              inválidas; a interface não é a única barreira.
            </li>
            <li>
              <b>Decimal.js:</b> cálculos monetários decimais evitam erros de
              ponto flutuante.
            </li>
            <li>
              <b>Groq com ferramentas:</b> o modelo investiga e encaminha, com
              credencial apenas no servidor. Evidências selecionadas são
              enviadas ao provedor durante a investigação.
            </li>
            <li>
              <b>PostgreSQL Neon e Drizzle:</b> persistência na hospedagem,
              versionamento e operações atômicas. Arquivos em .local servem ao
              desenvolvimento em uma instância.
            </li>
            <li>
              <b>Radix UI, CSS e fontes locais:</b> componentes de diálogo com
              gestão de foco, identidade consistente e menor dependência de
              recursos externos.
            </li>
          </ul>
        </details>
        <details>
          <summary>O que falta para uso interno real?</summary>
          <p>
            Hoje cada visitante tem sessão independente por cookie, expira em
            sete dias e usa data fixa. Isso evita interferência na demonstração,
            mas não é colaboração da equipe. Produção exige autenticação,
            permissões de operador e supervisor, fila compartilhada, atribuição
            por pessoa, histórico durável, calendário operacional atualizado e
            integração com sistemas de origem.
          </p>
          <p>
            Também será necessário definir retenção e acesso aos dados,
            homologar o provedor de IA e confirmar resultados financeiros com
            fontes externas. A demonstração pública deve usar somente dados
            sintéticos.
          </p>
        </details>
      </section>
      <section className="panel prose" id="method-pilot">
        <h2>Como decidir se a solução ajuda a equipe</h2>
        <p>
          No piloto, um operador novo deve conseguir encontrar o próximo pedido,
          entender o motivo da prioridade, revisar evidências, registrar uma
          tarefa executada e encerrar o caso sem orientação externa. Observe
          dificuldades e tempo por etapa; esta revisão de interface não
          substitui teste com pessoas da operação.
        </p>
        <p>
          Compare com FIFO usando capacidade e carteiras equivalentes. Meça
          tempo de triagem, pedidos tratados por hora, idade das pendências,
          reaberturas, tarefas aceitas sem correção e sucesso do agente com ação
          persistida. Valide responsáveis, capacidade por especialidade e
          critérios de encerramento antes de medir produtividade.
        </p>
        <p>
          Para avaliar efeito financeiro, cruze resultados com pagamentos,
          retenção e custos confirmados. Separe receita, margem, custo e
          benefício incremental. Defina metas e período com a equipe antes de
          concluir eficácia.
        </p>
        <Button variant="outline" onClick={onReset}>
          Reiniciar minha demonstração
        </Button>
        <p className="muted">
          Remove as tratativas da sessão atual e mantém a base importada para
          começar outra avaliação.
        </p>
      </section>
    </div>
  );
}
