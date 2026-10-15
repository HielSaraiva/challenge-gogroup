# Órbita · Central de Operações

Aplicação em português para priorizar pedidos com exceção, investigar concentrações e registrar encaminhamentos com um agente Groq. Next.js App Router, TypeScript, Tailwind, componentes no padrão shadcn/Radix, PostgreSQL Neon, Drizzle e Zod.

## Executar no computador

Pré-requisitos: Node.js 22+ e pnpm. Na raiz:

```sh
pnpm install
cp .env.example .env.local
```

Configure `GROQ_API_KEY` no `.env.local`. O modelo padrão é `openai/gpt-oss-120b`, disponível na conta usada no desenvolvimento e escolhido para execução de ferramentas. Altere `GROQ_MODEL` para outro modelo Groq com tool calling caso necessário. Nunca use `NEXT_PUBLIC_` para essas variáveis.

Extraia os três CSVs do arquivo fornecido para uma pasta privada. Importe e inicie:

```sh
pnpm import:data "caminho/privado/case_operacoes"
pnpm dev
```

Abra http://localhost:3000. Sem `DATABASE_URL`, os dados e sessões ficam em `.local/`, ignorado pelo Git. Esse modo é para uma única instância local; não funciona em Vercel. O agente exige chave real; não há respostas de IA simuladas na aplicação.

No PowerShell, para criar o arquivo de ambiente, use `Copy-Item .env.example .env.local`. Não substitua um `.env.local` já configurado.

## GitHub e Vercel

1. Envie somente código e configurações para o GitHub. `.env.local`, `.local/`, CSV, ZIP e PDF estão excluídos.
2. Na Vercel, importe o repositório como Next.js. Use Node.js 22 ou superior, `pnpm install --frozen-lockfile` e `pnpm build`.
3. Na aba Storage/Marketplace, conecte um banco **Neon Postgres** ao projeto. A Vercel hospeda interface/API; o Neon é um banco gerenciado externo. Não há necessidade de hospedar um servidor separado.
4. Configure `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL=openai/gpt-oss-120b`, `AGENT_SESSION_DAILY_LIMIT=10` e `AGENT_GLOBAL_DAILY_LIMIT=100`. Não configure `LOCAL_DEMO` em produção. Faça redeploy após ajustar variáveis.
5. Copie a conexão Neon para o `.env.local` do seu computador e crie as tabelas, sem publicar a base no Git:

```sh
# macOS/Linux: export DATABASE_URL='conexão do banco'
# PowerShell: $env:DATABASE_URL = 'conexão do banco'
pnpm db:push
pnpm import:data "caminho/privado/case_operacoes"
```

`import:data` lê `.env.local` automaticamente. `db:push` usa a variável `DATABASE_URL` do processo. Alternativamente: `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs push`.

6. Abra o deploy, investigue um pedido, confira a tarefa e atualize a página. Não publique os CSVs na pasta `public/` nem transforme o arquivo de base em um módulo importado pelo frontend.

Sem banco ou importação, a interface explica a configuração pendente; o deploy não inventa pedidos. Não existe endpoint público de importação. Para publicar previews de branches com dados isolados, configure um banco/branch Neon separado.

## O que o agente executa

O servidor implementa quatro ferramentas:

| Ferramenta | Efeito |
| --- | --- |
| `consultar_pedido` | Consulta fatos, cliente, contrato, cálculos e ações admitidas |
| `consultar_padroes` | Retorna concentração e IDs de evidências no escopo |
| `simular_tratativa` | Calcula custo indicativo; não executa transações |
| `criar_tarefa` | Persiste tarefa com evidências, área, prazo e justificativa |

O agente deve consultar o pedido antes de criar uma tarefa e simular antes de propor reembolso/reenvio. O servidor verifica evidências, escopo e compatibilidade e restringe as ferramentas conforme a etapa. Um conflito de status admite somente revisão de status. A justificativa é identificada como hipótese; os indicadores são acrescentados pelo servidor e o resumo final é composto de fatos calculados após o efeito útil, sem uma chamada adicional ao modelo. Propostas financeiras exigem aprovação humana e essa aprovação **só altera a demonstração**: não há APIs de pagamento, transportadora ou estoque.

As execuções têm no máximo seis rodadas, doze chamadas de ferramenta, duas tarefas e 45 segundos de orçamento. Há limites diários persistidos por sessão e globalmente. Retentativas preservam ações parciais; a chave de idempotência é pedido + tipo de tarefa por sessão. Cookie aleatório `HttpOnly`, `SameSite=Lax`, seguro em produção, com validade de sete dias; o banco guarda apenas seu hash. Cookies são estabelecidos antes das consultas paralelas.

Reiniciar a demonstração cria uma sessão nova. Registros antigos ficam inacessíveis pelo visitante e são eliminados do PostgreSQL após expiração durante a criação de sessões. O modo local mantém arquivos privados; não é armazenamento de produção. Logs não incluem payloads ou credenciais. Respostas e consultas de sessão usam `Cache-Control: private, no-store`; mutações exigem origem igual à da aplicação e JSON.

## Metodologia e resultados da base fornecida

Os arquivos do desafio e seus dados não são distribuídos neste repositório. Os números a seguir são resultados agregados reproduzíveis pelo importador:

| Indicador | Resultado |
| --- | --- |
| Linhas de origem | 2.042 |
| Pedidos únicos | 2.000 |
| Conflitos de status sem timestamp | 42 |
| Carteira sem dupla contagem | R$ 220.161,37 |
| Promessas divergentes de separação + SLA (pedidos únicos) | 1.822 |
| Exposição probabilística logística elegível | R$ 19.809,47 |
| Valor coberto pela fila priorizada (150) | R$ 39.313,73 |
| Valor coberto pela FIFO (150) | R$ 16.725,64 |
| Idade útil média, prioridade / FIFO | 22,54 / 36,86 dias |

A carteira priorizada cobre cerca de 2,35 vezes o valor de FIFO, mas deixa uma idade média menor: existe um compromisso entre valor e envelhecimento. Isso não prova recuperação, otimização econômica ou ganho causal.

- Referência fixa: **30/09/2026**. Dias úteis excluem fins de semana, 07/09 e 12/10. O dia seguinte útil ao pedido é a separação; somar SLA da rota transportadora/UF.
- Não corrigimos a promessa original. Mostramos a contratual ao lado e usamos a original para atraso. Pedidos entregues param de acumular atraso na entrega.
- Score = média ponderada de valor (45), urgência (35) e relacionamento (20), ×100. Valores são limitados a 1 após normalização. P95 usa nearest-rank (`ceil(0,95 × n)`). Urgência = `min(max(atraso, idade_excecao) / 10, 1)`. Valor é normalizado pelo P95 dos valores. Relacionamento = ticket histórico × probabilidade de recompra × 50%, normalizado pelo P95. Probabilidade de 70% acima de R$ 1.500 de receita histórica e 28% para demais. É uma proxy por pedido e não é somada como perda futura da carteira. Pesos se normalizam pela soma; empate por abertura mais antiga e ID.
- Cancelamento: somente logística não entregue e atrasada (atraso_entrega, extravio, rastreio_parado, devolvido_transportadora, avaria_transporte). Faixas: 1–2 dias 4%; 3–5 10%; 6–10 22%; acima de 10 40%. Exposição = valor × probabilidade; não é perda observada.
- Reenvio/reprodução = 24% × valor + frete da rota. Reembolso = valor. Cálculos com Decimal, arredondados a centavos por pedido. Item faltante não tem preço individual: custo de reenvio integral é somente proxy. Pagamento pendente não significa valor efetivamente recebido.
- Benefício simulado = exposição elegível selecionada × eficácia assumida; **antes de custos**, sem estimativa validada de eficácia. Nenhuma tarefa gera receita recuperada.
- Concentrações usam a base consolidada, não as 2.042 linhas. Sem todos os pedidos expedidos, não há denominador para medir taxa de falha nem prova de causa. Os 42 conflitos são preservados sem escolher arbitrariamente o status mais recente.
- Capacidade: 150 tratativas × 12 minutos = 30 horas de esforço do time por dia. Criar uma tarefa não significa que o pedido foi resolvido e não o remove automaticamente da fila original.

## API e verificações

GET `/api/dashboard`, `/api/orders?q=&type=&brand=&status=&page=1&limit=50`, `/api/queue?value=45&urgency=35&relationship=20`, `/api/insights`, `/api/tasks` e `/api/investigations`. As duas últimas são isoladas por sessão.

POST `/api/investigations`: `{ type: "order" | "pattern", target: string, requestId: UUID }`. Resposta NDJSON com eventos e resultado final, sem raciocínio interno do modelo. PATCH `/api/tasks`: `{ id: UUID, status: "concluida" | "aprovada" | "rejeitada" }`. POST `/api/session` inicia nova demonstração. Sempre enviar `Content-Type: application/json` e origem da aplicação nas mutações.

```sh
pnpm test
pnpm typecheck
pnpm build
# Com o servidor local aberto:
pnpm test:smoke
# Opcional: faz chamadas reais e consome a cota Groq
pnpm test:smoke --agent
```

Testes cobrem calendário e faixas, precisão, exclusão de risco não elegível, normalização, capacidade, evidências, escopo, compatibilidade, conflitos, propostas, idempotência, isolamento e falhas parciais do agente. Há uma verificação opcional da base original em `.local/source/`; sem os arquivos, ela é pulada. Mocks de Groq são usados apenas nos testes, nunca para simular IA na interface. Testes de ferramentas usam arquivos locais privados; a configuração do banco de produção não é necessária.

Antes de entregar, verificar também o fluxo **real** do Groq, a persistência no Neon, sessão em dois navegadores e os logs no deploy. A compilação local não confirma um deploy nem valida o banco remoto.

## Roteiro de apresentação

1. Mostre carteira, capacidade e a diferença entre valor e exposição.
2. Compare prioridade com FIFO, incluindo o compromisso com envelhecimento.
3. Abra um pedido e mostre pontuação, duas promessas e custo indicativo.
4. Execute o agente. Mostre ferramentas e a tarefa criada.
5. Atualize a página para comprovar persistência; abra outra sessão para demonstrar isolamento.
6. Investigue uma concentração e ressalve a ausência de causalidade.

Para a entrega final, use o link público da Vercel e o link público do código. A chave é configurada somente nas variáveis do servidor; se tiver sido compartilhada em conversa, substitua-a antes de publicar.
