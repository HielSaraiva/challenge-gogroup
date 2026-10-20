# Avaliação operacional e validação do piloto

## Adequação e contribuição da IA

A ferramenta apoia priorização, investigação e registro de encaminhamentos. Sua eficácia depende de observação com operadores e confirmação externa dos resultados. Não é uma fila colaborativa de produção.

O usuário escolhe o foco entre equilibrada, urgência ou relacionamento. O agente deve consultar o diagnóstico, comparar alternativas e aplicar a escolha solicitada antes de registrar um plano. Cada estratégia tem pesos explícitos e cálculos reproduzíveis. A contribuição persistida inclui estratégia, justificativa, seleção, comparação FIFO e orientação com primeiro pedido por área. A IA consulta amostras, sem alegar investigação de todos os dossiês.

A carteira recebida pode ser consultada antes da IA. A fila de trabalho só é publicada como plano após efeito persistido. Seu conjunto não é reposto automaticamente após encerramentos; nova seleção exige ação explícita. Planos de versões anteriores ou com base/status incompatível exigem atualização. Os registros são preservados na sessão, mas a interface apresenta apenas o plano ativo.

## Fluxos de aceite

1. Conferir a base disponível. Se necessário, importar os CSVs, conferir a prévia e confirmar a base exclusiva da sessão.
2. Opcionalmente, abrir Hoje e preparar um plano com IA. Acompanhar a etapa em andamento e as tentativas finalizadas da mais recente para a mais antiga. Pedidos pode ser usado diretamente, sem plano.
3. Conferir a estratégia e sua justificativa, abrir o pedido sugerido e ler os fatos concretos.
4. Investigar o pedido, revisar o encaminhamento e aprovar propostas quando necessário. Registrar ação executada e referência da evidência.
5. Encerrar com resultado compatível. Revisão de status sozinha não resolve a exceção. Aprovação sem execução permanece pendente.
6. Conferir em Resultados a situação atual dos pedidos, os problemas em aberto, as soluções e os valores registrados. Reabrir retira o pedido dos resolvidos e o inclui nos abertos; reabertos é um subconjunto dos abertos. Custos informados e reembolsos permanecem acumulados; estimativas de encerramentos atuais ficam separadas. Consultar detalhes individuais em Pedidos.
7. Em Recorrências, solicitar a análise da base. O agente deve comparar agrupamentos e trabalho anterior, selecionar até três achados e registrar títulos, hipóteses e próximos passos, ou justificar ausência de novos achados. Conferir os cards persistidos e suas referências calculadas. Abrir uma investigação não usa IA. Salvar uma conferência parcial, fechar e reabrir para verificar a retomada. Conferir busca e paginação, seleção preservada entre páginas e aviso de alterações não salvas. Salvar progresso deve manter a investigação em Pendências, sem encerrar pedidos. Após conferir ao menos dois pedidos, registrar a conclusão da equipe (resultado e observações obrigatórios, recomendação opcional); a pendência de investigação deve sair da lista. Uma versão antiga não pode sobrescrever um progresso mais recente nem concluir a investigação. Reanalisar a base exige confirmação e preserva registros sem duplicar grupos; retomar um grupo concluído exige ação específica. Os casos individuais continuam independentes.
8. Recarregar e conferir persistência. Outra sessão deve permanecer isolada. Reiniciar em Dados deve restaurar a base padrão de 30/09/2026, descartar a importação da sessão e começar sem tratativas.

## Critérios e limites das regras

A capacidade global fornecida é 150 tratativas diárias, com duração média de 12 minutos. O contador do piloto usa encerramentos como aproximação de esforço; reabrir não devolve a vaga. Produção precisa medir contatos e investigações e considerar capacidade por especialidade. Investigação de recorrência não entra automaticamente na capacidade individual.

As estratégias, a reserva de 20% para antigos e os limiares de sinais são heurísticas do projeto. Urgência usa o percentil 95 dos dias de espera/atraso para distinguir os casos sem saturar a pontuação de muitos pedidos. A tabela de probabilidade de cancelamento permanece independente e segue os parâmetros fornecidos.

A comparação com FIFO usa a fotografia da mesma base e capacidade. Valor coberto não prova recuperação. Sem todas as vendas ou produção, os padrões não demonstram taxas de falha ou causalidade. Uma hipótese registrada pela IA precisa de verificação de campo.

Resultados financeiros são declarações com referência, sem conciliação externa. Custos estimados e informados ficam separados. Valor do pedido não equivale a receita recuperada; não se calcula um saldo entre receita, reembolso e custos como se fosse lucro. Simulações específicas de custo apoiam as propostas de pedido.

## Validação técnica

A suíte verifica calendário, valores decimais, ranking, estratégias, reserva, capacidade, importação e isolamento. Para o agente: consulta antes de ação, comparação obrigatória, evidências válidas, cobertura de áreas, idempotência, fotografia do plano e falhas sem sucesso simulado, incluindo 429.

Conclusões individuais exigem execução documentada e resultado compatível. Reembolso exige valor positivo dentro do valor pago; endereço pode ser corrigido sem movimentação financeira. Conclusões de processo exigem referências distintas do grupo e não encerram seus pedidos. Registros legados permanecem legíveis, sem evidências fabricadas.

Os testes de ferramenta usam respostas controladas. O teste sintético opcional usa Groq real com dados fictícios próprios. Smoke HTTP confere contratos, origem e sessões; flags adicionais podem usar o provedor real. Homologação em PostgreSQL e hospedagem continua necessária antes de uso remoto.

## Piloto com operadores e evolução

Observe operadores novos executando o fluxo sem ajuda. Registre tempo, dúvidas, erros, reaberturas, encaminhamentos aceitos sem correção e sucesso da IA com ação persistida. Compare períodos ou grupos equivalentes com FIFO, mantendo carteira e capacidade comparáveis.

Defina metas e período antes de avaliar eficácia. Resultados financeiros exigem cruzamento com pagamentos, retenções e custos externos. Separe receita, margem e benefício incremental.

CSV é a entrada do piloto. Para uso diário, mapear ERP, atendimento e logística antes de integrar. São necessários IDs estáveis, timestamps de status, conciliação, carga incremental, monitoramento e reprocessamento. Também faltam autenticação, papéis, atribuição por pessoa, fila compartilhada, histórico durável, calendário atualizado e política homologada de acesso, retenção e uso de IA.

Os documentos de origem, arquivos do case e resultados privados não integram o repositório.

## Regressões para apresentação

- Encerrar junto à execução ou depois exige vínculo com uma execução válida da etapa atual. Reembolso não pode virar confirmação de entrega; evidência de despacho não comprova recebimento.
- Falha ao atualizar a tela depois de salvar deve informar que o registro foi salvo e oferecer atualização sem repetir a ação.
- Fechar formulários alterados exige confirmação; recarregar avisa sobre campos não salvos. Durante o salvamento, o modal permanece aberto.
- Reiniciar só permite uma solicitação por vez e invalida respostas antigas. A carga inicial usa `/api/workspace` para aplicar o mesmo estado nas abas.
- Preencher custo exige classificar como estimativa ou realizado. Desconhecido não vira zero.
- Reanálises percorrem agrupamentos menos examinados e preservam mais de um grupo relevante por dimensão; continuam limitadas a até três propostas por análise.

## Verificação desta revisão

- 143 testes de domínio/API aprovados; um teste opcional da base privada permanece ignorado.
- Oito cenários de navegador aprovados em Chrome, distribuídos entre desktop e celular, sobre build de produção e fixtures sintéticas. Incluem recarga com alterações não salvas, falha após gravação, conclusão sem recomendação, persistência após recarregar e reinício único.
- TypeScript, formatação e build de produção aprovados.
- Groq real validado com dados sintéticos: plano, tarefa individual e análise de recorrências com candidatos consultados persistidos.
- Neon validado com sessão sintética exclusiva: investigação, tarefa, idempotência e execução persistidas. Somente os registros dessa verificação foram removidos.
- Versão publicada validada em 18/10/2026 em https://challenge-gogroup.vercel.app: agente real de pedido, idempotência, encerramento, reabertura, recorrências, cobertura consultada, plano, persistência, isolamento e restauração da base padrão após reinício. Os testes usaram CSVs sintéticos e sessões exclusivas, sem alterar sessões de outros visitantes.

## Otimização do plano diário — 20/10/2026

O caminho real prepara diagnóstico e amostras no servidor e faz uma chamada ao modelo para comparar os indicadores e registrar as orientações. Não há chamadas ao modelo apenas para solicitar cálculos determinísticos nem reenvio do histórico completo. A resposta tem orçamento de 1.800 tokens; uma resposta inválida admite uma correção curta, preservando todas as validações de seleção, áreas e evidências.

O cenário sintético com 150 pedidos e oito áreas foi persistido na primeira chamada real do Groq: 2.357 tokens de entrada, 592 de saída e aproximadamente 1,3 segundo no teste local. São medições desse cenário, não uma garantia de latência ou disponibilidade do provedor. A cota por minuto pode ser atingida dentro de uma execução, mesmo após dias sem uso. Os contadores de consumo ficam nos detalhes técnicos.

Após o deploy de 20/10/2026, o botão “Preparar meu dia com IA” também foi validado pela interface publicada, sobre a base padrão: plano registrado na primeira tentativa, em uma resposta do modelo, com 2.391 tokens de entrada e 772 de saída. A página foi recarregada e o plano permaneceu disponível. Os testes de regressão somam 145 aprovados e um opcional ignorado; TypeScript, formatação e build passaram.

## Otimização das demais análises — 20/10/2026

Pedidos, descoberta de recorrências e investigação de processo passam a consultar as evidências no servidor antes da inferência. Simulações financeiras admitidas também são calculadas previamente, sem execução externa ou aprovação automática. O modelo escolhe o encaminhamento e produz a hipótese e a verificação. Mantêm-se validações de compatibilidade, evidências, reabertura, rejeições, sobreposição e reutilização de registros.

Cada requisição leva apenas o contexto do modo, a ferramenta necessária e, quando houver rejeição, um erro controlado para correção. Não se reenvia a conversa completa. Os orçamentos de saída são 1.200 tokens para pedido/processo e 2.000 para descoberta de recorrências, com no máximo uma correção nesses caminhos. O sinal exploratório legado mantém a escolha do pedido pelo modelo e as consultas necessárias, também com contexto compacto. Não há resposta fictícia para substituir falhas do provedor.

Em recorrências, pedidos repetidos entre candidatos são enviados uma única vez. Atributos comuns ficam em `orderDefaults`; diferenças ficam em `orders[id]`. A reconstrução preserva integralmente os campos das amostras, indicadores dos candidatos e registros anteriores. O teste com mais de dezesseis agrupamentos verifica também o avanço da cobertura entre análises.

Verificações com o Groq real e dados próprios fictícios concluíram na primeira resposta: pedido individual (1.056 tokens), descoberta de recorrências (927), investigação de processo (1.028) e reanálise com registros anteriores (1.154). Uma base sintética maior, com 2.000 pedidos e dezesseis candidatos enviados, gerou três investigações em uma resposta, com 3.350 tokens de entrada e 287 de saída. Os números representam esses cenários, sem prometer disponibilidade do provedor ou conclusões idênticas em toda execução.

A validação publicada detectou uma rejeição de formato de ferramenta (`tool_use_failed`, HTTP 400) no caminho com função nomeada. O pedido passou a exigir uma chamada com `tool_choice: required`, expondo apenas a ferramenta cabível e explicitando seus argumentos no prompt, sem desabilitar a validação do provedor ou do servidor. Falhas registram somente status HTTP, código e tipo com caracteres limitados; a resposta bruta do provedor não é persistida.

Após o ajuste, os testes reais publicados concluíram na primeira resposta: pedido (903 tokens), descoberta de recorrências (1.068), plano diário (1.692), investigação de processo (1.010) e nova etapa vinculada à conclusão anterior (1.075). Também foram conferidos idempotência, encerramento, reabertura, persistência e isolamento. Todos usaram sessões exclusivas com CSVs fictícios, restauradas ao final, sem alteração da sessão do usuário ou de outros visitantes.

Regressão final: 159 testes aprovados, um opcional ignorado; TypeScript, formatação e build aprovados. O comando de implantação aceita `--process-only` para conferir investigação de processo e retomada sem repetir os demais fluxos ou consumir suas chamadas ao modelo.
