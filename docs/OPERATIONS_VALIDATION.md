# Avaliação operacional e roteiro de validação

## Avaliação de adequação

A aplicação apoia decisões de triagem e encaminhamento. O agente transforma consultas em registros executáveis, com responsável, evidências, próximo passo e prazo. Essa é uma utilidade funcional verificável. A eficácia em reduzir cancelamentos, custo ou tempo de resolução depende de um piloto com operadores e resultados externos; não foi demonstrada por esta implementação.

| Pergunta do time                                          | Decisão apoiada                                                                                                     | Como conferir                                                                                                    | Limite                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Quais pedidos tratar hoje e por quê?                      | Seleção dentro da capacidade restante, reserva para antigos, pontuação explicável e plano por área                  | Abrir Operação hoje, preparar plano, abrir uma frente e revisar o motivo de seleção de cada pedido               | Heurística ajustável; valor coberto não equivale a recuperação. A capacidade agregada não garante disponibilidade de cada especialidade |
| O que está causando as exceções?                          | Sinais por dimensões operacionais e divergência verificável entre promessa e regra contratual                       | Em Causas e processos, comparar participação na exceção com participação na base elegível e investigar a amostra | Associação não prova causa. Faltam denominadores de todas as vendas e validação de campo                                                |
| O que resolver individualmente e o que mudar no processo? | Tarefas individuais e investigações de processo com escopos separados                                               | Investigar um pedido e um padrão de processo; comparar responsável, evidências e próximo passo                   | Melhorias exigem diagnóstico, esforço dimensionado e aprovação fora da demonstração                                                     |
| Quanto dinheiro está em risco e quanto foi recuperado?    | Exposição elegível, cenário com eficácia e custo assumidos, registros declarados e recuperação comprovada separados | Conferir Impacto financeiro; encerrar sem resultado financeiro e verificar que não cria recuperação              | Não há confirmação externa de retenção ou pagamentos; resultados da sessão não demonstram efeito causal                                 |

## O papel central do agente

O agente opera em três níveis:

1. **Planejar o dia:** consulta a seleção determinística e registra orientação para todas as áreas envolvidas. A IA escolhe o foco e encaminhamento; o servidor preserva os pedidos e verifica a capacidade.
2. **Investigar um pedido:** consulta o dossiê, usa evidências e registra uma tarefa compatível com a exceção. Simula custos antes de propor medidas financeiras. Status conflitantes exigem revisão.
3. **Investigar um processo:** consulta o padrão, escolhe evidências e registra uma ação de melhoria para validar a hipótese no conjunto. A conclusão dessa ação não encerra pedidos individuais.

As ferramentas não aceitam efeitos arbitrários: validam esquema, escopo, evidências existentes, consulta prévia e idempotência. Números e fatos são calculados pelo domínio; os textos do agente são qualitativos e identificados como orientações ou hipóteses. Isso reduz espaço para afirmações quantitativas inventadas, mas não elimina a necessidade de revisão humana do encaminhamento.

As dimensões analisadas são selecionadas conforme a etapa operacional. Uma coincidência entre campos sem relação com a tratativa, como pagamento e transportadora, não gera recomendação. A classificação de sinal de processo usa limiares heurísticos de amostra, participação e associação relativa, descritos na aplicação; não representa significância estatística ou uma causa validada. O plano consulta roteiros de triagem por área para orientar ações executáveis sobre os pedidos, enquanto mudanças de processo recebem investigação própria.

O fluxo tem limite de rodadas, chamadas, tempo e uso persistido. Falhas ficam no histórico, preservam efeitos e permitem nova tentativa. A falta de uma ação persistida impede declarar sucesso. Não há envio de mensagens, pagamentos ou mudanças reais em sistemas operacionais.

## Verificações automatizadas

Os testes públicos usam cenários fictícios e verificam:

- Calendário útil, elegibilidade de exposição, valores decimais e ranking determinístico.
- Reserva para envelhecimento, seleção única e redução de capacidade após encerramento, inclusive com reabertura.
- Consulta antes de ação, evidências válidas, rejeição de alegações quantitativas livres e exigência de cobertura de todas as áreas no plano.
- Persistência e idempotência de planos e tarefas, isolamento de visitantes e falha do provedor.
- Separação entre ação de processo e encerramento individual.
- Resultado financeiro opcional com evidência, limites por pedido e separação entre declaração e recuperação comprovada.

Os testes de ferramentas usam respostas controladas do modelo. O smoke opcional usa Groq real e verifica efeitos via HTTP. A homologação na Vercel com PostgreSQL é uma etapa adicional e exige serviços configurados.

## Roteiro de demonstração

1. Abrir uma sessão sem login e conferir a capacidade disponível.
2. Preparar o plano com o agente e acompanhar as ferramentas executadas.
3. Abrir uma frente, revisar o motivo de seleção e comparar a política com FIFO nos mesmos lugares disponíveis.
4. Investigar um pedido, revisar os fatos e concluir a tarefa. Encerrar o caso com justificativa; conferir sua saída da fila e o consumo de capacidade.
5. Investigar um padrão de processo. Ler a hipótese, amostra e próxima verificação. Conferir que os pedidos associados continuam pendentes.
6. Abrir Impacto financeiro. Separar exposição, simulação, resultado declarado e recuperação comprovada. Alterar a eficácia e informar custo no cenário.
7. Recarregar a página e conferir persistência. Abrir outro perfil de navegador para verificar isolamento.

## Piloto para medir eficácia real

Antes do piloto, validar com o time os responsáveis por área, critérios de encerramento, capacidade por especialidade e esforço de cada tipo de tarefa. A capacidade da demonstração representa tratativas individuais concluídas no dia de referência; não modela tempo real, pausas ou calendário de escalas.

Comparar períodos ou grupos equivalentes com uma linha de base FIFO, mantendo capacidade e critérios de elegibilidade. Registrar composição da carteira e mudanças simultâneas do processo para não atribuir à ferramenta efeitos de outra origem.

Medir tempo de triagem, pedidos tratados por hora, envelhecimento dos casos restantes, reaberturas, encaminhamentos aceitos sem correção, duplicações e tarefas sem evidência suficiente. Para o agente, registrar frequência de sucesso com efeito persistido, erro de ferramenta, tempo, custo e revisão humana necessária.

Para efeito financeiro, cruzar pedidos elegíveis com retenções e pagamentos confirmados, custos de reenvio, reembolso e esforço operacional. Comparar com a linha de base; receita preservada declarada não é lucro nem recuperação incremental. Definir com o time as metas e o período de observação antes de avaliar o piloto.

Materiais e resultados da base privada não fazem parte deste documento.
