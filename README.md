# Gogroup · Go Operations

**Uma central de operações que transforma exceções em encaminhamentos rastreáveis.**

Go Operations responde quais pedidos tratar hoje, como encaminhá-los e quais sinais exigem investigar o processo. O agente consulta evidências e usa ferramentas do servidor para registrar um plano diário, tarefas individuais e investigações de recorrência. Cada visitante recebe uma demonstração independente, sem login.

Projeto demonstrativo desenvolvido para um desafio técnico, com identidade visual inspirada no [site público do Gogroup](https://estagiogogroup.com.br/). Este repositório contém a aplicação e testes sintéticos; materiais, registros e resultados da base privada não são distribuídos nesta documentação.

## Capacidades

| Aba          | Função                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| Hoje         | Resumo da carteira e plano opcional com IA, limitado à capacidade disponível                |
| Pedidos      | Carteira completa ou seleção do plano, filtros, investigação individual e histórico do caso |
| Pendências   | Tratativas iniciadas e investigações ainda abertas, com próximo passo e paginação           |
| Resultados   | Dashboard da situação atual, problemas abertos, soluções registradas e valores informados   |
| Recorrências | Seleção de achados pelo agente, com hipótese, evidências calculadas e conclusão da equipe   |
| Dados        | Origem da base, importação validada por sessão e reinício da demonstração                   |
| Metodologia  | Fluxo de uso, critérios de priorização, conceitos financeiros e limites do piloto           |

## Arquitetura

| Camada       | Tecnologia                            | Responsabilidade                                              |
| ------------ | ------------------------------------- | ------------------------------------------------------------- |
| Interface    | Next.js App Router, React, TypeScript | Navegação, filtros, dossiês e progresso das investigações     |
| Design       | Tailwind CSS, Radix UI, Poppins       | Componentes acessíveis e identidade visual                    |
| API          | Next.js Route Handlers, Zod           | Validação, sessão e contratos HTTP                            |
| Domínio      | TypeScript, Decimal.js                | Calendário, consolidação, priorização e cálculos monetários   |
| Agente       | Groq SDK e chamadas de ferramentas    | Encaminhamentos a partir de evidências consultadas            |
| Persistência | PostgreSQL Neon, Drizzle ORM          | Base imutável, sessões, tarefas, decisões e limites de uso    |
| Hospedagem   | Vercel                                | Interface e funções de API; o Neon fornece o banco gerenciado |

As regras de cálculo são determinísticas e independem do modelo. A IA investiga e escolhe o encaminhamento. O servidor verifica escopo, evidências e compatibilidade antes de persistir o efeito de uma ação.

### Organização do código

```text
src/
  app/          Páginas, estilos e endpoints HTTP
  components/   Interface e controles de tratativa
  domain/       Modelos e regras de negócio
  server/       Agente, sessão, armazenamento e esquema do banco
  lib/          Utilitários de apresentação
scripts/        Importação administrativa e verificações HTTP
tests/          Testes de domínio, ferramentas e persistência
drizzle/        Migrações SQL versionadas
public/         Recursos visuais públicos
```

## Execução local

Requisitos: **Node.js 22 ou superior** e **pnpm**.

```sh
pnpm install
```

Crie `.env.local` a partir de `.env.example`:

```sh
# macOS / Linux
cp .env.example .env.local

# PowerShell
Copy-Item .env.example .env.local
```

Preencha as variáveis necessárias. Não substitua um arquivo de ambiente já configurado.

| Variável                    | Uso                                                               |
| --------------------------- | ----------------------------------------------------------------- |
| `GROQ_API_KEY`              | Credencial do agente, exclusivamente no servidor                  |
| `GROQ_MODEL`                | Modelo Groq com ferramentas; padrão definido em `.env.example`    |
| `DATABASE_URL`              | Conexão PostgreSQL Neon; obrigatória na Vercel                    |
| `LOCAL_DEMO`                | Armazenamento local para desenvolvimento; não habilitar na Vercel |
| `AGENT_SESSION_DAILY_LIMIT` | Limite diário de investigações por sessão                         |
| `AGENT_GLOBAL_DAILY_LIMIT`  | Limite diário global de investigações                             |

Importe os CSVs autorizados a partir de uma pasta privada:

```sh
pnpm import:data "/caminho/privado/operacoes"
pnpm dev
```

Acesse [localhost:3000](http://localhost:3000). Também é possível abrir **Dados**, selecionar os três CSVs, validar a prévia e confirmar a importação. Essa carga é exclusiva da sessão; não substitui a base administrativa nem afeta outros visitantes. Use somente dados sintéticos na demonstração pública. O limite é 2 MB no total, até 10 mil pedidos, 10 mil clientes e 2 mil contratos. Pedidos e eventos posteriores à referência fixa de 30/09/2026 são bloqueados. Não é aceita troca de base com tratativas ativas: reinicie a demonstração antes. Reiniciar restaura a base padrão de 30/09/2026 e começa uma sessão sem importações ou tratativas.

O importador valida campos, contratos, relacionamentos e conflitos antes de salvar. O comando administrativo continua disponível para preparar a base inicial do servidor. Arquivos e base importada ficam fora do Git.

Sem `DATABASE_URL`, o desenvolvimento salva dados e sessões em `.local/`, ignorado pelo Git. Esse modo serve somente para uma instância local. O agente exige uma credencial válida; respostas simuladas existem apenas nos testes.

## Banco e implantação

1. Importe o repositório na Vercel com o preset **Next.js**.
2. Conecte um banco **Neon Postgres** pelo Marketplace da Vercel.
3. Configure as variáveis do servidor descritas acima. Credenciais não devem usar o prefixo `NEXT_PUBLIC_`. Não habilite `LOCAL_DEMO` na Vercel.
4. No computador do administrador, configure a conexão em `.env.local` e execute:

```sh
pnpm db:prepare "/caminho/privado/operacoes"
```

5. Faça o deploy com `pnpm install --frozen-lockfile` e `pnpm build`.
6. Verifique no endereço publicado: abertura sem login, investigação real, persistência após recarregar e isolamento entre navegadores.

`db:prepare` aplica as migrações SQL versionadas e carrega a base padrão apenas se ela ainda não existir. Repetir o comando preserva a base e as sessões existentes. O diretório dos CSVs é privado e não deve ir para o Git. Para substituir intencionalmente a base administrativa, use `pnpm import:data`.

Na Vercel, `vercel.json` executa `pnpm db:migrate` antes do build. Assim, as tabelas são criadas antes de publicar o backend; a credencial `DATABASE_URL` precisa estar disponível também no build. Falta de conexão ou falha de migração interrompe o deploy, sem publicar uma versão que dependa de tabelas ausentes. Migrações futuras devem ser compatíveis com a versão ainda publicada. A carga dos CSVs não roda durante o build: ela é feita uma vez pelo administrador com `db:prepare`. Para esta PoC, local e Vercel podem usar o mesmo banco. Não alterne `db:push` e migrações no mesmo banco sem reconciliar o histórico.

Sem banco ou importação, a interface orienta a configuração e oferece a área Dados para importação por sessão. A aplicação não inclui uma base pública. Criação do banco e configuração das credenciais são etapas externas ao código.

## Funcionamento do agente

O modelo recebe ferramentas restritas conforme a etapa:

| Ferramenta                       | Resultado                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `consultar_pedido`               | Fatos, indicadores calculados, ações admitidas e IDs válidos de evidência                |
| `consultar_padroes`              | Concentração observada e amostra de pedidos relacionados                                 |
| `simular_tratativa`              | Custo indicativo de uma alternativa, sem execução financeira                             |
| `criar_tarefa`                   | Tarefa persistida com justificativa, evidências, responsável e prazo                     |
| `consultar_diagnostico`          | Diagnóstico da carteira e métricas das alternativas de estratégia                        |
| `comparar_estrategias`           | Escolha justificada e consulta das frentes da estratégia aplicada                        |
| `consultar_fila`                 | Seleção calculada, capacidade, comparação com FIFO e frentes de trabalho                 |
| `registrar_plano_dia`            | Plano persistido com orientação para cada área da seleção calculada                      |
| `criar_acao_processo`            | Investigação de recorrência vinculada a um sinal e a evidências consultadas              |
| `consultar_recorrencias`         | Agrupamentos calculados, amostras e investigações anteriores para comparação pelo agente |
| `registrar_analise_recorrencias` | Seleção justificada de até três investigações ou registro de ausência de novos achados   |

Consultar o pedido é obrigatório antes de criar uma tarefa. Propostas financeiras exigem simulação prévia e avaliação humana. Após aprovar, o operador precisa registrar a execução; aprovação sozinha não permite encerrar a exceção. Um conflito de status bloqueia outras tratativas até uma revisão explícita. A justificativa é identificada como hipótese do agente; fatos e números verificados aparecem separadamente.

O usuário escolhe o foco do plano. O agente consulta o diagnóstico, compara três estratégias e aplica exatamente a estratégia solicitada. Os cálculos são feitos no servidor; a seleção priorizada do plano só aparece depois de ele ser salvo; a carteira completa pode ser consultada e investigada antes disso. O plano registra a estratégia, justificativa, referência da base, comparação FIFO e orientações para todas as áreas. O agente escolhe um primeiro pedido da amostra por área e indica o próximo passo. Encerramentos atualizam o progresso sem repor pedidos; outro plano exige solicitação explícita. Gerar esse plano não cria tarefas em lote. A investigação explícita do pedido escolhido cria um encaminhamento individual. Ações de processo exigem um padrão consultado e evidências distintas. Elas não encerram o conjunto de pedidos. Uma resposta textual sem plano ou tarefa persistida não conclui uma investigação.

O modelo padrão é `openai/gpt-oss-20b`, com esforço de raciocínio baixo. O planejamento restringe cada chamada à ferramenta da etapa atual. Uma resposta 429 com espera explícita de até 12 segundos permite uma única nova tentativa por chamada, respeitando o orçamento total e cancelamento. Esperas maiores ou sem indicação não geram repetição automática.

As execuções têm orçamento de tempo, limite de chamadas e controle de concorrência. Falhas do provedor preservam o histórico e efeitos já registrados. A idempotência evita duplicar uma mesma ação na sessão.

## Sessões, integridade e privacidade

- A base importada permanece imutável. Revisões, encerramentos e reaberturas são sobreposições exclusivas da sessão.
- Pendências mostra apenas trabalho em aberto, com uma entrada por pedido e investigações de processo ainda não concluídas. A lista é paginada e não mistura históricos de análises ou planos. Resultados mostra a situação atual da base, problemas abertos, tipos de solução e valores registrados, sem lista individual de encerramentos. Os detalhes ficam em Pedidos; custo desconhecido continua distinto de zero.
- Recorrências começa com “Analisar recorrências com IA”. O agente consulta até 16 agrupamentos calculados, priorizando os menos examinados em reanálises, com amostras de até três pedidos e registros anteriores, compara as evidências e propõe até três investigações por análise. Título, hipótese, justificativa da seleção e verificação recomendada são produzidos pelo agente; números e referências são validados pelo servidor. Uma seleção vazia é aceita com justificativa, sem cards artificiais. Os cards são tarefas persistidas, com paginação, e só surgem após o registro do agente. Investigações antigas permanecem acessíveis.
- Uma nova análise geral exige confirmação e preserva o trabalho anterior: sinais já registrados ou conjuntos praticamente idênticos são reutilizados, sem sobrescrever conclusões. Para investigar novamente um grupo já concluído, há uma ação explícita que cria uma etapa vinculada à anterior. Abrir um registro não usa a IA. Uma investigação de processo pode consultar pedidos encerrados sem reabri-los ou alterar seus resultados.
- O modal de recorrência prioriza a hipótese e a verificação recomendada. Os pedidos têm busca, paginação de cinco itens por padrão e referências do agente primeiro. A equipe pode salvar progresso parcial com anotações, próximos passos e pedidos conferidos, mantendo a investigação em Pendências. “Registrar conclusão” é uma ação distinta e exige duas referências válidas e observações e resultado preenchidos; a recomendação seguinte é opcional. Alterações não salvas geram aviso ao sair; versões concorrentes são recusadas para impedir sobrescrita de progresso ou conclusão.
- Propostas de reenvio e reembolso exigem aprovação humana. A decisão não executa ações externas; a rejeição exige motivo e mantém o pedido em acompanhamento. Uma nova proposta após rejeição recebe uma identidade própria, mantendo a idempotência das repetições. Reenvio despachado aguarda recebimento; o comprovante do despacho não serve como evidência de recebimento. A validação de status conclui automaticamente a tarefa de revisão correspondente, sem encerrar a exceção original.
- Reabrir inicia uma nova etapa de atendimento: o pedido fica em Pendências aguardando investigação, os eventos de encerramento e reabertura permanecem no histórico do caso, os encaminhamentos da etapa anterior não entram na etapa atual e o novo encerramento exige tarefa e execução posteriores à reabertura. Repetir a criação da mesma tarefa dentro da etapa preserva a idempotência. Os indicadores operacionais consideram a situação atual do pedido. Custos declarados e reembolsos são acumulados pelas etapas registradas, inclusive após reabertura, sem contar novamente a projeção do encerramento atual. Em uma nova etapa, informe somente novos valores; o total de reembolsos não pode ultrapassar o valor do pedido. Estimativas dos encerramentos atuais ficam separadas de despesas declaradas.
- Um cookie aleatório `HttpOnly`, `SameSite=Lax` e seguro em produção identifica o visitante. O servidor armazena seu hash.
- Tarefas, investigações e decisões são isoladas por visitante. Sessões possuem expiração.
- Mutações validam origem, conteúdo e regras de transição. Credenciais e conexões não são incluídas em respostas ou logs.
- Arquivos de ambiente, dados importados e materiais do desafio são excluídos do versionamento.
- Controle de versão no banco evita a sobrescrita de decisões concorrentes.

## Critérios e limites

A pontuação combina componentes normalizados de valor, urgência e relacionamento. A seleção reserva parte da capacidade para os casos mais antigos e preenche as demais vagas por pontuação, para reduzir o adiamento contínuo de pedidos de menor valor. Antes de cada geração, o usuário escolhe entre equilibrada (45/35/20), urgência (25/55/20) e relacionamento (25/30/45). A IA compara as alternativas e aplica a estratégia solicitada; o servidor rejeita uma estratégia diferente. Valor, urgência e relacionamento são normalizados pelo percentil 95, limitados a 1; os empates seguem critérios determinísticos. Cada encerramento consome capacidade da data de referência da demonstração; reabrir preserva o esforço consumido. O esforço de investigação de recorrências requer dimensionamento próprio. A metodologia detalhada fica na aplicação.

Valor de carteira, exposição estimada, custos estimados e custos registrados são conceitos distintos. Tarefas concluídas não representam receita recuperada. Concentrações em uma base de exceções não demonstram causalidade ou taxa de falha da operação completa.

O encerramento exige resultado operacional e evidência, além de tarefa executada com documentação. Reembolso exige valor positivo limitado ao pedido. Custos desconhecidos não viram zero; estimativas ficam separadas de valores informados. A revisão de status, sozinha, não resolve a exceção original. Registros antigos sem os novos campos são identificados como legados. Estimativas de custo apoiam propostas específicas e não são apresentadas como recuperação financeira.

Encerrar um caso atualiza a demonstração. Aprovar uma proposta registra uma decisão; registrar sua execução é uma etapa separada, com ação realizada e evidência obrigatórias. Concluir uma investigação de recorrência exige observações e duas referências distintas relacionadas; a recomendação seguinte é opcional, sem encerrar os pedidos. Não existem integrações de envio a clientes, pagamento, reembolso, transportadora ou estoque.

## Qualidade e validação

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm format:check

# Regressões de interface em desktop e celular (Chrome instalado)
pnpm test:browser
```

Com a aplicação em execução:

```sh
pnpm test:smoke

# Opcional: Groq real com dados fictícios próprios
pnpm test:agent:synthetic

# Fluxos HTTP sobre a base carregada na demonstração
pnpm test:smoke --agent

# Plano diário e ação de processo com Groq real
pnpm test:smoke --strategic

# Execuções separadas para contas com cota reduzida
pnpm test:smoke --plan
pnpm test:smoke --process
```

A suíte cobre calendário, precisão monetária, elegibilidade de risco, ranking, importação, ferramentas, idempotência, isolamento, conflitos e ciclo de encerramento. Testes públicos utilizam dados fictícios próprios. Verificações adicionais da base privada são opcionais e não publicam seus resultados.

Testes locais não substituem a validação do fluxo real na Vercel e da persistência no banco remoto.

Veja a [avaliação de utilidade e o roteiro de validação operacional](docs/OPERATIONS_VALIDATION.md) para critérios de aceite, limitações e desenho de um piloto.

## Recursos visuais

Paleta e tipografia foram inspiradas na referência pública indicada. `public/gogroup-logo.svg` tem origem em [estagiogogroup.com.br](https://estagiogogroup.com.br/assets/gogroup-logo.svg) e é usado para contextualizar este projeto demonstrativo. A fonte Poppins é servida localmente pelo pacote `@fontsource/poppins`.

Os testes de navegador criam uma cópia temporária da aplicação, fazem o build de produção e usam somente fixtures sintéticas. Não carregam `.env.local`, não acessam a base local do desenvolvedor e não chamam o provedor de IA. A rota de preparação dos testes é criada apenas nessa cópia e não faz parte da aplicação publicada. O servidor temporário e seus dados são removidos ao final.
