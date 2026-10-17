# Identidade da interface

Referência visual: https://estagiogogroup.com.br/ (consultada em outubro de 2026).

A aplicação adapta a identidade da campanha para uma ferramenta de operações. O logotipo original mantém suas proporções. A abertura prioriza a tarefa do operador: escolher um pedido, investigar e executar, registrar o resultado. A marca oferece contexto sem ocupar o espaço principal de trabalho.

## Tokens

| Papel              | Valor             |
| ------------------ | ----------------- |
| Azul principal     | #2659a5           |
| Rosa de referência | #e61782           |
| Lima de destaque   | #d7d900           |
| Texto              | #1c1c1c           |
| Texto secundário   | #62636b           |
| Superfície         | #ffffff / #f7f7f7 |

Poppins é servida localmente, em pesos de 400 a 700. Títulos principais usam escala fluida; os textos de operação preservam densidade sem repetir a escala de uma landing page. Formulários móveis usam fonte de 16px.

## Composição e movimento

A navegação horizontal dá protagonismo à marca. A abertura azul usa a grade, os circuitos e os contornos circulares presentes na referência, desenhados em CSS e SVG. O restante da interface privilegia listas, divisores, hierarquia e contraste. Rosa identifica a ação principal; o lima pontua a capacidade e o fluxo.

A resposta dos botões e o progresso das investigações oferecem feedback. A preferência por redução de movimento desativa animações e transições. Os grafismos são decorativos e ficam fora da árvore de acessibilidade.

No celular, o menu recolhe a navegação; a comparação das filas passa a uma coluna e as tabelas mantêm rolagem própria. As regras de cálculo e os fluxos do agente são independentes desta camada visual.

Os botões com texto branco usam a variação #d51075 para contraste de 5,05:1; o rosa de referência é preservado nos acentos gráficos.

O selo usa os arquivos originais [rotate-detail.svg](https://estagiogogroup.com.br/assets/rotate-detail.svg) e [g-detail.svg](https://estagiogogroup.com.br/assets/g-detail.svg) da referência. Apenas o anel gira, em 12 segundos; o símbolo central permanece estável.

## Fluxo revisado para piloto

A navegação usa Hoje, Pedidos, Pendências, Resultados, Recorrências, Dados e Metodologia. As abas ficam no histórico da URL, permitindo voltar e compartilhar a seção. Hoje permite preparar um plano com IA; essa preparação é opcional para investigar pedidos. Pedidos oferece a carteira completa e, quando há plano válido, sua seleção priorizada. A comparação com FIFO fica disponível depois do plano salvo.

O modal do pedido reúne fatos, investigação, revisão de status, aprovação de propostas, execução com evidência e resultado compatível. A evidência da execução pode ser vinculada ao resultado para evitar repetição. Reenvio aguarda confirmação de recebimento. Reabrir inicia nova etapa sem reaproveitar a execução anterior para encerrá-la.

Pendências lista apenas o acompanhamento em aberto, com uma entrada por pedido e investigações de recorrência não concluídas. Resultados é um dashboard: resumo da operação, valores registrados e gráficos de problemas abertos e soluções. Detalhes individuais continuam em Pedidos.

Recorrências tem cards padronizados e paginação. O botão abre um modal com sinal observado, grupo, quantidade e referências calculados pelas regras do sistema. A análise com IA cria uma hipótese e uma verificação recomendada, identificadas como conteúdo do agente. A equipe documenta sua própria conclusão. Abrir uma investigação existente não gera nova chamada; outra análise após conclusão exige confirmação.

Detalhes de cálculo e limites ficam na Metodologia, com índice por assunto e seções expansíveis. Dados oferece origem da base, seleção dos CSVs, prévia, confirmação e reinício da demonstração. A atividade do agente mostra a etapa em andamento e tentativas finalizadas da mais recente para a mais antiga; detalhes técnicos ficam recolhidos. Erros de importação orientam a correção sem reproduzir conteúdo bruto do parser. A importação afeta somente a sessão atual.

A revisão aplica linguagem da operação, reconhecimento em vez de memorização, visibilidade de andamento, prevenção de erros e divulgação progressiva. A avaliação é heurística; a facilidade para operadores novos ainda depende de observação no piloto. Referências: [heurísticas de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/) e [ordem de foco WCAG](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).
