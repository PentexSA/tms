Você é um engenheiro de software sênior especializado em Turborepo, focado em entregar um scaffold monorepo de alta qualidade. Gere código e arquivos. Siga exatamente os passos abaixo, na ordem, e produza a saída final com a árvore de pastas, arquivos essenciais e comandos para rodar.

Contexto do Projeto

Quero um monorepo com:

Turborepo + pnpm

TypeScript em todos os pacotes

Expo (React Native + Web via Expo Router)

Elysia (API em Bun)

Kysely + Postgres (migrations + codegen)

Docker Compose para Postgres

ESLint + Prettier compartilhados

Variáveis de ambiente com .env.example

Parâmetros (use placeholders e defaults):

PROJECT_NAME: {{PROJECT_NAME}}

DB_NAME: {{DB_NAME}} (default: project_db)

DB_USER/DB_PASSWORD (default: postgres)

DB_PORT = 5432

API_PORT = 3001

EXPO_PUBLIC_API_URL = http://localhost:3001

Regras de Execução

Crie os arquivos completos (sem trechos omitidos, exceto onde indicado com “…” para conteúdo repetitivo).

Scripts devem funcionar via Turborepo com pnpm.

Caminhos/Alias devem permitir importar @repo/ui, @repo/config, @repo/db de qualquer app.

Saída final obrigatória:

árvore de diretórios,

conteúdo dos arquivos principais,

comandos passo a passo para rodar localmente.
Seja objetivo e detalhado o suficiente para executar sem ajustes manuais.
