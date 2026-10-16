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

A navegação usa Hoje, Pedidos, Pendências, Resultados, Melhorias, Dados e Metodologia. As abas ficam no histórico da URL, permitindo voltar e compartilhar a seção. Hoje prioriza preparar o dia com IA. Antes da execução aparece a carteira recebida; a seleção de trabalho e a comparação FIFO só aparecem após o plano registrado. O dossiê mostra fatos concretos e mantém investigação, revisão, aprovação, execução com evidência e resultado compatível no mesmo contexto. Pontuações percentuais e simulador genérico de eficácia foram retirados da rotina.

Detalhes de cálculo e distinções técnicas ficam na Metodologia, com navegação por assunto e seções expansíveis. Dados oferece seleção dos CSVs, prévia, confirmação e reinício da demonstração. A atividade do agente usa etapas numeradas em ordem cronológica; detalhes técnicos ficam recolhidos. Melhorias possui investigação própria com conclusão documentada, sem ação de concluir nos cartões. Erros indicam campos e linhas quando possível, sem reproduzir conteúdo bruto do parser. A confirmação da importação afeta somente a sessão atual.

A revisão aplica linguagem da operação, reconhecimento em vez de memorização, visibilidade de andamento, prevenção de erros e divulgação progressiva. A avaliação é heurística; a facilidade para operadores novos ainda depende de observação no piloto. Referências: [heurísticas de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/) e [ordem de foco WCAG](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).
