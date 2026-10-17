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
7. Em Recorrências, solicitar a análise da base. O agente deve comparar agrupamentos e trabalho anterior, selecionar até três achados e registrar títulos, hipóteses e próximos passos, ou justificar ausência de novos achados. Conferir os cards persistidos e suas referências calculadas. Abrir uma investigação não usa IA. Salvar uma conferência parcial, fechar e reabrir para verificar a retomada. Conferir busca e paginação, seleção preservada entre páginas e aviso de alterações não salvas. Salvar progresso deve manter a investigação em Pendências, sem encerrar pedidos. Após conferir ao menos dois pedidos, registrar a conclusão da equipe; a pendência de investigação deve sair da lista. Uma versão antiga não pode sobrescrever um progresso mais recente nem concluir a investigação. Reanalisar a base exige confirmação e preserva registros sem duplicar grupos; retomar um grupo concluído exige ação específica. Os casos individuais continuam independentes.
8. Recarregar e conferir persistência. Outra sessão deve permanecer isolada. Reiniciar em Dados deve preservar a base e começar sem tratativas.

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
