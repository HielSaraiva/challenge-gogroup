# Gogroup · Go Operations

**Uma central de operações que transforma exceções em encaminhamentos rastreáveis.**

Go Operations combina priorização explicável, investigação assistida por IA e acompanhamento de tratativas. O agente consulta evidências e usa ferramentas do servidor para registrar tarefas. Cada visitante recebe uma demonstração independente, sem login.

Projeto demonstrativo desenvolvido para um desafio técnico, com identidade visual inspirada no [site público do Gogroup](https://estagiogogroup.com.br/). Este repositório contém a aplicação e testes sintéticos; materiais, registros e resultados da base privada não são distribuídos nesta documentação.

## Capacidades

| Área             | Funcionalidade                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Visão geral      | Indicadores da carteira pendente e progresso da sessão                                                 |
| Fila de trabalho | Priorização por valor, urgência e relacionamento, pesos ajustáveis e comparação com FIFO               |
| Dossiê do pedido | Evidências, explicação da prioridade, prazos e custos indicativos                                      |
| Investigações    | Concentrações operacionais com amostra e referências verificáveis                                      |
| Agente de IA     | Consulta de fatos, simulação de alternativas e criação persistente de tarefas                          |
| Tratativas       | Revisão de status conflitante, conclusão de tarefas, avaliação de propostas, encerramento e reabertura |
| Auditoria        | Histórico de decisões e isolamento das alterações por visitante                                        |

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

Acesse [localhost:3000](http://localhost:3000). O importador valida contratos, relacionamentos e conflitos antes de salvar a base. Não há endpoint público de importação.

Sem `DATABASE_URL`, o desenvolvimento salva dados e sessões em `.local/`, ignorado pelo Git. Esse modo serve somente para uma instância local. O agente exige uma credencial válida; respostas simuladas existem apenas nos testes.

## Banco e implantação

1. Importe o repositório na Vercel com o preset **Next.js**.
2. Conecte um banco **Neon Postgres** pelo Marketplace da Vercel.
3. Configure as variáveis do servidor descritas acima. Credenciais não devem usar o prefixo `NEXT_PUBLIC_`. Não habilite `LOCAL_DEMO` na Vercel.
4. No computador do administrador, configure a conexão em `.env.local` e execute:

```sh
pnpm db:push
pnpm import:data "/caminho/privado/operacoes"
```

5. Faça o deploy com `pnpm install --frozen-lockfile` e `pnpm build`.
6. Verifique no endereço publicado: abertura sem login, investigação real, persistência após recarregar e isolamento entre navegadores.

`db:push` lê a configuração local de ambiente e sincroniza o esquema do banco selecionado. Revise a conexão antes de executá-lo. As migrações SQL também ficam versionadas para revisão. Use bancos ou branches Neon separados para produção e prévias.

Sem banco ou importação, a interface informa que a configuração está pendente. A aplicação não inclui uma base pública. Criação do banco e configuração das credenciais são etapas externas ao código.

## Funcionamento do agente

O modelo recebe ferramentas restritas conforme a etapa:

| Ferramenta          | Resultado                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| `consultar_pedido`  | Fatos, indicadores calculados, ações admitidas e IDs válidos de evidência |
| `consultar_padroes` | Concentração observada e amostra de pedidos relacionados                  |
| `simular_tratativa` | Custo indicativo de uma alternativa, sem execução financeira              |
| `criar_tarefa`      | Tarefa persistida com justificativa, evidências, responsável e prazo      |

Consultar o pedido é obrigatório antes de criar uma tarefa. Propostas financeiras exigem simulação prévia e avaliação humana. Um conflito de status bloqueia outras tratativas até uma revisão explícita. A justificativa é identificada como hipótese do agente; fatos e números verificados aparecem separadamente.

As execuções têm orçamento de tempo, limite de chamadas e controle de concorrência. Falhas do provedor preservam o histórico e efeitos já registrados. A idempotência evita duplicar uma mesma ação na sessão.

## Sessões, integridade e privacidade

- A base importada permanece imutável. Revisões, encerramentos e reaberturas são sobreposições exclusivas da sessão.
- Um cookie aleatório `HttpOnly`, `SameSite=Lax` e seguro em produção identifica o visitante. O servidor armazena seu hash.
- Tarefas, investigações e decisões são isoladas por visitante. Sessões possuem expiração.
- Mutações validam origem, conteúdo e regras de transição. Credenciais e conexões não são incluídas em respostas ou logs.
- Arquivos de ambiente, dados importados e materiais do desafio são excluídos do versionamento.
- Controle de versão no banco evita a sobrescrita de decisões concorrentes.

## Critérios e limites

A prioridade combina componentes normalizados de valor, urgência e relacionamento. Os pesos são ajustáveis e os empates seguem critérios determinísticos. A metodologia detalhada fica na aplicação, junto ao contexto da base autorizada.

Valor de carteira, exposição estimada, custo de intervenção e benefício simulado são conceitos distintos. Tarefas concluídas não representam receita recuperada. Concentrações em uma base de exceções não demonstram causalidade ou taxa de falha da operação completa.

Encerrar um caso atualiza a demonstração. Aprovar uma proposta registra uma decisão. Não existem integrações de envio a clientes, pagamento, reembolso, transportadora ou estoque.

## Qualidade e validação

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm format:check
```

Com a aplicação em execução:

```sh
pnpm test:smoke

# Opcional: consome a cota da API Groq
pnpm test:smoke --agent
```

A suíte cobre calendário, precisão monetária, elegibilidade de risco, ranking, importação, ferramentas, idempotência, isolamento, conflitos e ciclo de encerramento. Testes públicos utilizam dados fictícios próprios. Verificações adicionais da base privada são opcionais e não publicam seus resultados.

Testes locais não substituem a validação do fluxo real na Vercel e da persistência no banco remoto.

## Recursos visuais

Paleta e tipografia foram inspiradas na referência pública indicada. `public/gogroup-logo.svg` tem origem em [estagiogogroup.com.br](https://estagiogogroup.com.br/assets/gogroup-logo.svg) e é usado para contextualizar este projeto demonstrativo. A fonte Poppins é servida localmente pelo pacote `@fontsource/poppins`.
