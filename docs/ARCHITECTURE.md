# Arquitetura

O projeto usa arquitetura em camadas e apresentação organizada por funcionalidade. Na interface, os principais fluxos seguem MVVM com hooks React: a view renderiza o estado e encaminha eventos; o view model controla o rascunho, as ações assíncronas e o feedback. As regras operacionais e a persistência são validadas no servidor.

## Estrutura

| Camada         | Local                | Responsabilidade                                                                                           |
| -------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| Domínio        | `src/domain`         | Tipos, cálculos, validações e transições operacionais, independentes de React, HTTP, banco e IA.           |
| Aplicação      | `src/application`    | Casos de uso de pedidos e tarefas e orquestração do agente. Depende do domínio e dos contratos em `ports`. |
| Infraestrutura | `src/infrastructure` | Implementações de persistência PostgreSQL/local e integração com Groq.                                     |
| Composição     | `src/server`         | Conecta contratos às implementações e adapta sessões, configuração e erros ao ambiente Next.js.            |
| Apresentação   | `src/presentation`   | Views, view models, componentes compartilhados e estilos.                                                  |
| Rotas          | `src/app`            | Pontos de entrada do Next.js: páginas, layout e adaptadores HTTP em `api`.                                 |
| Utilitários    | `src/shared`         | Formatação, paginação, valores monetários e controle de respostas antigas.                                 |

Os componentes de interface ficam em `presentation/features`, agrupados em pedidos, planejamento do dia, pendências, resultados, recorrências, dados e metodologia. O shell coordena navegação e abertura dos fluxos. Os testes seguem as camadas em `tests/domain`, `tests/application`, `tests/infrastructure` e `tests/presentation`; `tests/browser` cobre a aplicação completa.

## Direção das dependências

- O domínio não importa outras camadas do projeto.
- A aplicação usa contratos de repositório e de execução do agente; não importa implementações concretas de banco ou provedor.
- A infraestrutura implementa esses contratos. As operações que alteram tarefa e encerramento em conjunto permanecem atômicas.
- `server/container.ts` conecta os casos de uso ao repositório; `server/agent.ts` conecta a investigação ao repositório, provedor e política de repetição.
- As views dos fluxos não fazem chamadas HTTP. Seus view models controlam as requisições e expõem estado e ações à interface.
- O código do navegador não importa aplicação, infraestrutura ou composição do servidor. As importações exclusivamente de tipos são removidas na compilação.

Os contratos refletem as operações necessárias ao MVP, incluindo gravações atômicas, controle de versão e exclusão mútua. Não há contêiner de injeção, classes-base ou framework adicional: as dependências são passadas como objetos tipados.

## Fluxo de uma alteração

A view encaminha a ação ao view model, que valida o preenchimento e envia a requisição. O adaptador HTTP verifica origem e sessão e chama o caso de uso configurado na composição. O caso de uso aplica as regras do domínio e solicita a gravação ao repositório. O resultado retorna à interface, que confirma o salvamento e atualiza o workspace.

`GET /api/workspace` monta indicadores, pedidos, plano, tarefas e análises a partir do mesmo estado da sessão. A interface aplica esse retrato de uma vez e descarta respostas anteriores a uma troca de sessão ou importação. Uma falha de atualização não transforma uma gravação concluída em erro nem repete a IA ou a importação.

Reabrir inicia uma nova etapa, preservando histórico e valores registrados. Execuções e resultados permanecem vinculados à etapa correspondente. As validações do servidor continuam obrigatórias mesmo quando a interface já restringe a ação.

## Agente e persistência

O servidor calcula prioridades, amostras e alternativas. A IA produz orientações e solicita ferramentas; a aplicação valida escopo, compatibilidade e evidências antes de persistir seus efeitos. Prompts, ferramentas e preparação das requisições ficam juntos em `application/agent`; transporte e repetição do provedor ficam em `infrastructure/ai`.

A versão publicada usa PostgreSQL com sessões isoladas por visitante. O modo local usa arquivos com substituição atômica e exclusão mútua no processo; destina-se ao desenvolvimento e aos testes. O esquema, as migrações e o formato dos registros foram preservados.

## Interface e estilos

Componentes reutilizáveis ficam em `presentation/shared/ui`. Os formulários compartilham validação, mensagens junto aos campos e resumo acessível de erros. Os painéis de análise usam `AgentProgress`.

Os estilos ficam em `presentation/styles` e são importados pelo layout na ordem: `base.css`, fontes, `components.css`, `brand.css`, `dialogs.css` e `workspace.css`. A cascata e os seletores existentes foram preservados.

## Verificação

`pnpm test` cobre regras, casos de uso, persistência, contratos do agente e limites entre camadas. Os testes de arquitetura detectam dependências invertidas, ciclos em execução, acesso ao servidor pelo navegador e chamadas HTTP dentro das views. `pnpm typecheck` verifica TypeScript estrito e código sem uso; `pnpm format:check` verifica formatação.

`pnpm test:browser` executa um build isolado e valida fluxos em desktop e emulação móvel, usando dados sintéticos e sem chamar o provedor. `pnpm test:agent:synthetic` exercita o Groq real em armazenamento temporário próprio e consome sua cota. Disponibilidade do provedor e testes em aparelhos físicos permanecem verificações externas à suíte local.
