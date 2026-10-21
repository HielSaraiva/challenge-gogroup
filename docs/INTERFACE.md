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

Os painéis de análise de pedidos, do plano do dia e de recorrências usam o mesmo componente `AgentProgress`: cartão branco com borda arredondada, título azul, etapas em blocos de fundo claro com barra lateral, horário à direita e detalhes técnicos recolhidos. As etapas aparecem da mais recente para a mais antiga. Estados em andamento e interrompidos preservam essa estrutura, com mensagens e cores de alerta próprias. No celular, os recuos diminuem e os horários podem quebrar de linha.

A navegação horizontal dá protagonismo à marca. A abertura azul usa a grade, os circuitos e os contornos circulares presentes na referência, desenhados em CSS e SVG. O restante da interface privilegia listas, divisores, hierarquia e contraste. Rosa identifica a ação principal; o lima pontua a capacidade e o fluxo.

A resposta dos botões e o progresso das investigações oferecem feedback. A preferência por redução de movimento desativa animações e transições. Os grafismos são decorativos e ficam fora da árvore de acessibilidade.

No celular, o menu recolhe a navegação; a comparação das filas passa a uma coluna e as tabelas mantêm rolagem própria. As regras de cálculo e os fluxos do agente são independentes desta camada visual.

Os botões com texto branco usam a variação #d51075 para contraste de 5,05:1; o rosa de referência é preservado nos acentos gráficos.

O selo usa os arquivos originais [rotate-detail.svg](https://estagiogogroup.com.br/assets/rotate-detail.svg) e [g-detail.svg](https://estagiogogroup.com.br/assets/g-detail.svg) da referência. Apenas o anel gira, em 12 segundos; o símbolo central permanece estável.

## Fluxo revisado para piloto

A navegação usa Hoje, Pedidos, Pendências, Resultados, Recorrências, Dados e Metodologia. As abas ficam no histórico da URL, permitindo voltar e compartilhar a seção. Hoje permite preparar um plano com IA; essa preparação é opcional para investigar pedidos. Pedidos oferece a carteira completa e, quando há plano válido, sua seleção priorizada. A comparação com FIFO fica disponível depois do plano salvo.

O modal do pedido reúne fatos, investigação, revisão de status, aprovação de propostas, execução com evidência e resultado compatível. A evidência da execução pode ser vinculada ao resultado para evitar repetição. Reenvio aguarda confirmação de recebimento. Reabrir inicia nova etapa sem reaproveitar a execução anterior para encerrá-la.

Pendências lista apenas o acompanhamento em aberto, com uma entrada por pedido e investigações de recorrência não concluídas. Resultados é um dashboard: resumo da operação, valores registrados e gráficos de problemas abertos e soluções. Detalhes individuais continuam em Pedidos.

Recorrências começa com a análise da base por IA. O agente compara agrupamentos, amostras e investigações anteriores, seleciona até três achados por análise e cria títulos e hipóteses próprios. Os números vêm dos cálculos do sistema. Cards padronizados e paginados aparecem apenas para investigações persistidas; abrir um card exibe o contexto calculado e o conteúdo do agente, seguido da verificação da equipe. Uma análise pode não propor novos achados. Reanalisar exige confirmação, preserva os registros e evita duplicação. O modal guia objetivo, consulta de pedidos e registro da verificação. Busca e paginação substituem a lista longa; as referências da IA aparecem primeiro. Salvar progresso mantém a investigação aberta e permite retomada; concluir exige um resultado e duas referências conferidas. A saída com alterações não salvas exige uma escolha explícita. Retomar um grupo concluído é uma ação separada e explícita.

Detalhes de cálculo e limites ficam na Metodologia, com índice por assunto e seções expansíveis. Dados oferece origem da base, seleção dos CSVs, prévia, confirmação e reinício da demonstração. A atividade do agente mostra a etapa em andamento e tentativas finalizadas da mais recente para a mais antiga; detalhes técnicos ficam recolhidos. Erros de importação orientam a correção sem reproduzir conteúdo bruto do parser. A importação afeta somente a sessão atual.

A revisão aplica linguagem da operação, reconhecimento em vez de memorização, visibilidade de andamento, prevenção de erros e divulgação progressiva. A avaliação é heurística; a facilidade para operadores novos ainda depende de observação no piloto. Referências: [heurísticas de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/) e [ordem de foco WCAG](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html).

As regras compartilhadas dos modais ficam em `src/app/dialog.css`; variações por fluxo ficam em `workspace.css`. Os botões de fechar têm alvo de toque de 44 px. A investigação de recorrência mantém atalhos opacos durante a rolagem e permite registrar conclusão sem recomendação obrigatória. Formulários de pedido avisam antes de descartar edições; o salvamento bem-sucedido permanece confirmado mesmo quando a atualização da tela falha.

## Verificação de consistência

Revisão com as skills `ui-ux-pro-max` e `frontend-design`: as sete abas foram conferidas em desktop (1440 px), tablet (768 px) e celular (320 e 390 px), antes e depois de um plano ativo, incluindo estados vazios. Os modais de pedido, resultado, recorrência e confirmação foram inspecionados por capturas de tela e medidas do navegador em uma cópia isolada com dados sintéticos.

As confirmações compartilham largura, tipografia, espaçamento e ações em `dialog.css`; no celular, os botões ficam em coluna. Os modais de trabalho preservam a largura necessária para seus formulários. Etiquetas usam 12 px, e os seletores de CSV respeitam a largura interna do card. A tabela de pedidos mantém rolagem horizontal própria.

A suíte de navegador verifica ausência de transbordamento nas páginas e nos modais, contenção dos campos de arquivo, foco e proteção contra descarte, além dos fluxos de execução, conclusão, reabertura e reinício. As capturas desativam animações para registrar o estado final da interface. Esta revisão não substitui um teste de usabilidade com a equipe.

No celular estreito, o cabeçalho preserva o logotipo e o menu na mesma linha, ocultando apenas o subtítulo da marca para não cobrir o índice da Metodologia. Avisos com ações usam os botões compartilhados, com borda e largura completa no celular; o estilo dos botões de dispensar não interfere nessas ações. A navegação do índice por teclado preserva o foco no título e o mantém abaixo dos elementos fixos.

O índice da Metodologia acompanha a posição da leitura e destaca a seção atual também no desktop. Em telas menores, uma faixa branca opaca preenche a largura abaixo do cabeçalho e o botão mostra o nome da seção, sem deixar o texto visível nas frestas ao redor do controle. Selecionar uma seção fecha o menu e posiciona seu título abaixo da barra; rolar manualmente atualiza apenas a indicação, sem mudar o foco ou adicionar entradas ao histórico. Escape e toque fora fecham o índice.
