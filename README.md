# Go Operations · Gogroup

Central de operações para priorizar pedidos com exceção, investigar casos com IA e acompanhar os resultados da equipe. Projeto demonstrativo desenvolvido para o desafio AI-First do Gogroup, no contexto das operações da Gocase e da GoBeauté.

**[Acessar demonstração](https://challenge-gogroup.vercel.app/)** · Sem login, com sessões independentes por visitante.

## Funcionalidades

| Área         | Recursos                                                                            |
| ------------ | ----------------------------------------------------------------------------------- |
| Hoje         | Plano com IA, escolha de estratégia e sugestões por área que acompanham o progresso |
| Pedidos      | Carteira completa, filtros, investigação individual e histórico                     |
| Pendências   | Aprovações, execuções e investigações em aberto                                     |
| Resultados   | Indicadores operacionais, capacidade de planejamento e valores registrados          |
| Recorrências | Hipóteses propostas pela IA, conferência de evidências e conclusões da equipe       |
| Dados        | Importação validada por sessão e reinício da demonstração                           |
| Metodologia  | Critérios de priorização, fluxo de trabalho e premissas do projeto                  |

O servidor calcula prioridades e indicadores; a IA compara evidências e registra planos e encaminhamentos por ferramentas validadas. A equipe aprova propostas, documenta a execução e confirma o resultado. A aplicação não realiza envios, pagamentos ou reembolsos externos.

O piloto usa a referência operacional de **30/09/2026** e capacidade de **150 tratativas** para planejar o trabalho. Essa referência não bloqueia o registro de resultados. Encerramentos atualizam as sugestões do plano sem novas chamadas à IA.

## Tecnologias

- **Interface e API:** Next.js App Router, React, TypeScript, Tailwind CSS e Radix UI.
- **Regras e validação:** Zod e Decimal.js, com cálculos independentes do modelo de IA.
- **IA e persistência:** Groq SDK, Neon PostgreSQL e Drizzle ORM.
- **Testes e hospedagem:** Vitest, Playwright e Vercel.

As regras ficam em `src/domain`, a orquestração e persistência em `src/server`, e a interface em `src/components` e `src/app`.

## Executar localmente

Requisitos: **Node.js 22+** e **pnpm**.

```sh
pnpm install
cp .env.example .env.local
```

Configure `.env.local` conforme o modo de execução:

| Variável       | Configuração                                                                           |
| -------------- | -------------------------------------------------------------------------------------- |
| `GROQ_API_KEY` | Chave do Groq para executar o agente real                                              |
| `GROQ_MODEL`   | Modelo com suporte a ferramentas; padrão: `openai/gpt-oss-20b`                         |
| `DATABASE_URL` | Conexão Neon PostgreSQL; obrigatória na Vercel                                         |
| `LOCAL_DEMO`   | `true` para desenvolvimento com arquivos locais, sem `DATABASE_URL`; `false` na Vercel |

Os limites de análises por sessão e globais estão em [.env.example](.env.example). Credenciais são usadas exclusivamente no servidor.

Prepare a base com os arquivos `pedidos_excecao.csv`, `clientes.csv` e `transportadoras.csv` em um diretório autorizado:

```sh
pnpm import:data "/caminho/dos/csvs"
pnpm dev
```

Abra [localhost:3000](http://localhost:3000). Sem banco, os dados ficam em `.local/`, fora do Git. Os arquivos do desafio não acompanham o repositório.

A aba **Dados** também permite importar uma base exclusiva da sessão. Reiniciar a demonstração restaura a base padrão e limpa os registros daquela sessão.

## Publicar na Vercel

1. Importe o repositório com o preset **Next.js** e conecte um banco Neon PostgreSQL.
2. Configure `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL` e `LOCAL_DEMO=false` nas variáveis do servidor.
3. Com a conexão do banco configurada em `.env.local`, prepare a base inicial:

   ```sh
   pnpm db:prepare "/caminho/dos/csvs"
   ```

4. Faça o deploy. O [vercel.json](vercel.json) aplica as migrações antes do build; `DATABASE_URL` deve estar disponível nessa etapa.

`db:prepare` preserva a base já existente. A importação dos CSVs é uma etapa administrativa e não ocorre durante o build.

## Validação

```sh
pnpm test
pnpm typecheck
pnpm format:check
pnpm build
```

Para testar a interface em desktop e celular, com Chrome instalado:

```sh
pnpm test:browser
```

Os testes de navegador usam uma aplicação temporária com dados sintéticos, sem acessar o banco configurado ou chamar a IA. Para validar o agente real com dados fictícios isolados, execute `pnpm test:agent:synthetic`; esse comando requer a chave e utiliza a cota do Groq.

## Documentação

- [Critérios operacionais, limites e roteiro de validação](docs/OPERATIONS_VALIDATION.md)
- [Identidade visual e interface](docs/INTERFACE.md)
- [Arquitetura e responsabilidades](docs/ARCHITECTURE.md)

A aba **Metodologia** descreve as regras e o fluxo de uso. A identidade visual utiliza o [logotipo público do Gogroup](https://estagiogogroup.com.br/assets/gogroup-logo.svg) e a fonte Poppins.
