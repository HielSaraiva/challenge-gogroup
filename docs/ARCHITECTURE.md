# Arquitetura

O MVP usa uma única aplicação Next.js com interface React, Route Handlers e PostgreSQL. As camadas separam regras operacionais de efeitos externos; não há serviços distribuídos nem integrações de execução automática.

## Responsabilidades

| Local                    | Responsabilidade                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain`             | Tipos, validações e transições dos casos, priorização, planejamento e indicadores. Não depende da interface, de HTTP ou da persistência.             |
| `src/server`             | Orquestração dos casos de uso, sessões, limites, integração com IA e persistência.                                                                   |
| `src/server/agent`       | Contratos, catálogo de ferramentas, execução validada, prompts e adaptação das chamadas ao Groq. `server/agent.ts` coordena o ciclo da investigação. |
| `src/server/persistence` | Conexão PostgreSQL, armazenamento local e controle de concorrência e uso. `server/store.ts` coordena as gravações operacionais.                      |
| `src/app/api`            | Entrada HTTP: verifica origem, identifica a sessão, valida a entrada e traduz erros em respostas.                                                    |
| `src/components`         | Telas e formulários. `OperationsApp` coordena navegação e diálogos; cada workspace apresenta sua área da operação.                                   |
| `src/components/hooks`   | Estado da carteira, carga do workspace e proteção de formulários.                                                                                    |
| `src/lib`                | Utilitários compartilhados, transporte de leitura e decodificação da resposta incremental da IA.                                                     |

Os rótulos operacionais ficam em `domain/labels.ts`. Formatação monetária, datas e composição de classes ficam em `lib/utils.ts`. A Metodologia documenta o comportamento do produto; este arquivo documenta a organização do código.

## Interface

Botões, diálogos, expansíveis e paginação são compartilhados em `src/components/ui`. As análises usam `AgentProgress`. Formulários usam `ValidatedForm` e `FormField` para mensagens junto aos campos, resumo de erros e navegação acessível até o problema. Os estilos são carregados por `src/app/layout.tsx`: base em `globals.css`, composição em `operations.css`, identidade em `brand.css`, modais em `dialog.css` e ajustes dos fluxos em `workspace.css`. A ordem de carregamento faz parte da cascata de estilos.

## Estado e gravações

`GET /api/workspace` monta os indicadores, pedidos, plano, tarefas e análises a partir do mesmo estado da sessão. `useWorkspace` aplica essa resposta de uma vez e descarta respostas anteriores a uma troca de sessão ou importação. Os filtros permanecem ativos ao navegar entre abas; reiniciar limpa o estado da demonstração.

Gravar uma operação e atualizar a interface são etapas separadas. Uma falha de atualização preserva a confirmação de salvamento e oferece uma nova consulta, sem repetir a gravação nem chamar a IA novamente. A importação invalida a base anterior antes de carregar a nova.

As gravações preservam o vínculo entre execução, resultado e etapa do pedido. Reabrir inicia uma nova etapa sem apagar histórico ou valores já informados. As validações no servidor permanecem obrigatórias mesmo quando a interface já restringe a ação.

## Agente e persistência

O servidor calcula prioridades, amostras, valores e alternativas. A IA produz orientações qualitativas e solicita ferramentas; o servidor valida escopo, compatibilidade e evidências antes de persistir seus efeitos. Limites, prazo de execução, repetição controlada e idempotência impedem novas tentativas ilimitadas ou efeitos duplicados.

O modo publicado usa PostgreSQL com sessões isoladas por visitante. O modo local usa arquivos com escrita por substituição e uma fila de exclusão mútua no processo. Ele serve ao desenvolvimento e aos testes; não substitui a concorrência do banco em produção. Os registros de versões anteriores permanecem compatíveis com os fluxos atuais.

## Verificação

- `pnpm typecheck`: TypeScript estrito, incluindo imports, parâmetros e variáveis sem uso.
- `pnpm test`: regras, API, persistência local, contratos do agente, decodificação do stream e limites de arquitetura.
- `pnpm test:browser`: build isolado e fluxos em desktop e emulação móvel, com dados sintéticos e sem chamadas ao provedor.
- `pnpm test:agent:synthetic`: integração real com o Groq, em diretório temporário próprio; consome a cota do provedor.

Os testes de arquitetura impedem ciclos de imports em execução, dependência do domínio em infraestrutura e acesso ao servidor pela árvore de imports do navegador. Importações exclusivamente de tipos não entram no bundle do cliente.

A suíte cobre os fluxos conhecidos do MVP; não representa garantia de ausência de defeitos. Disponibilidade e cotas do Groq são dependências externas, e a emulação móvel não substitui testes em aparelhos físicos.
