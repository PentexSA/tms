# TMS - Gerenciador de Fichas de RPG

Sistema de gerenciamento de fichas de personagem para RPG de mesa. A proposta é suportar qualquer sistema de jogo; esta versão tem foco no **World of Darkness (WoD)**.

Monorepo fullstack com Turborepo, Expo (React Native + Web), Elysia (Bun) e PostgreSQL.

## 🎲 Sobre o Projeto

- **Usuários** criam personagens e participam de **crônicas** (campanhas) conduzidas por um **Storyteller** (narrador).
- Cada crônica pertence a um **sistema de jogo** (`game_systems`), por exemplo Vampiro: A Máscara.
- A estrutura da ficha de cada sistema é definida por um **template de traços** (`trait_templates`, jsonb): atributos, habilidades, disciplinas, virtudes etc.
- Os valores de cada personagem ficam em `characters.sheet_data` (jsonb), seguindo o template do sistema.

Com isso, adicionar um novo sistema é questão de cadastrar o sistema e seu template, sem alterar o schema do banco. O modelo completo está em [`doc/database.dbml`](doc/database.dbml).

## 📋 Requisitos

- **Node.js** LTS (v18+)
- **pnpm** (v8+)
- **Bun** (v1.2+)
- **Docker** & Docker Compose

## 🚀 Setup Rápido

```bash
# 1. Instalar dependências
pnpm install

# 2. Copiar variáveis de ambiente (opcional)
cp .env.example .env

# 3. Iniciar banco de dados PostgreSQL
pnpm db:up

# 4. Rodar migrations
pnpm db:migrate

# 5. Gerar tipos TypeScript do banco
pnpm db:codegen

# 6. Iniciar todos os apps em desenvolvimento
pnpm dev
```

## 📖 Passo a Passo Detalhado

### 1️⃣ Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (v18 ou superior): [nodejs.org](https://nodejs.org)
- **pnpm** (v8 ou superior):
  ```bash
  npm install -g pnpm
  ```
- **Bun** (v1.2 ou superior): [bun.sh](https://bun.sh)
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **Docker Desktop**: [docker.com/get-started](https://www.docker.com/get-started)

### 2️⃣ Clone e Configuração Inicial

```bash
# Clone o repositório
git clone <url-do-repositorio>
cd tms

# Instale todas as dependências do monorepo
pnpm install
```

### 3️⃣ Configuração do Banco de Dados

```bash
# 1. Copie o arquivo de exemplo de variáveis de ambiente
cp .env.example .env

# 2. (Opcional) Edite o .env se precisar customizar portas ou credenciais
# Padrões: postgres:postgres@localhost:5432/tms

# 3. Inicie o PostgreSQL via Docker Compose
pnpm db:up

# Aguarde alguns segundos para o banco inicializar completamente

# 4. Execute as migrations para criar as tabelas
pnpm db:migrate

# 5. Gere os tipos TypeScript a partir do schema do banco
pnpm db:codegen
```

### 4️⃣ Iniciando a Aplicação

#### Opção A: Rodar Tudo Simultaneamente

```bash
# Inicia API + Frontend em paralelo
pnpm dev
```

Aguarde até ver as mensagens:
- ✓ API rodando em `http://localhost:3001`
- ✓ Expo pronto - pressione 'w' para abrir no navegador

#### Opção B: Rodar Apps Separadamente

**Terminal 1 - API:**
```bash
cd apps/api
bun run dev
```

**Terminal 2 - Frontend:**
```bash
cd apps/frontend
npx expo start
```

### 5️⃣ Acessando a Aplicação

- **API REST**: http://localhost:3001
- **Documentação Swagger**: http://localhost:3001/swagger
- **Frontend Web**: Pressione `w` no terminal do Expo ou acesse http://localhost:8081
- **Frontend Mobile**:
  - Android: Pressione `a` no terminal do Expo
  - iOS: Pressione `i` no terminal do Expo (apenas macOS)
  - Expo Go App: Escaneie o QR Code com o app Expo Go

### 6️⃣ Verificação

Execute os seguintes comandos para garantir que está tudo funcionando:

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Build (opcional - testa se o build funciona)
pnpm build
```

### 7️⃣ Parando a Aplicação

```bash
# Parar os apps (Ctrl+C nos terminais)

# Parar e remover o banco de dados Docker
pnpm db:down
```

## 📁 Estrutura do Monorepo

```
tms/
├── apps/
│   ├── api/          # API REST com Elysia (Bun)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/     # App React Native + Web (Expo Router)
│       ├── app/
│       ├── assets/
│       ├── App.tsx
│       ├── app.json
│       ├── metro.config.js
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── config/       # Configurações e variáveis de ambiente
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── db/           # Kysely + migrations + codegen
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── migrate.ts
│   │   │   ├── types.ts
│   │   │   └── migrations/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── eslint-config/ # Configs ESLint compartilhadas
│   │   └── package.json
│   ├── tsconfig/     # Configs TypeScript base
│   │   └── package.json
│   └── ui/           # Componentes UI universais (RN + Web)
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── .env.example
├── .eslintrc.cjs
├── .prettierrc
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 🔧 Variáveis de Ambiente

Crie um arquivo `.env` na raiz com:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tms
API_PORT=3001
EXPO_PUBLIC_API_URL=http://localhost:3001
```

## 📜 Scripts Principais

### Global (Root)

```bash
pnpm dev              # Inicia todos os apps em paralelo
pnpm build            # Build de todos os pacotes/apps
pnpm lint             # Lint em todo o monorepo
pnpm typecheck        # Type check em todo o monorepo
pnpm test             # Roda todos os testes

# Database
pnpm db:up            # Inicia PostgreSQL (docker)
pnpm db:down          # Para e remove volumes do PostgreSQL
pnpm db:migrate       # Roda migrations
pnpm db:codegen       # Gera tipos TypeScript do schema
```

### Deploy de teste (Render + Neon)

Os PRs entram na `main`; o Render publica só a branch `release` (`render.yaml`,
`deploy/render/`). Para subir o que está na `main`, corte uma release:

```bash
pnpm release              # release avança até a origin/main, com a tag release-AAAAMMDD-HHMMSS
pnpm release <commit>     # corte de um commit que já está na main
```

O corte só avança (fast-forward) e pede confirmação. Para voltar atrás, use o
Rollback do Render ou reverta na `main` e corte de novo.

### Apps Individuais

```bash
# API (Elysia + Bun)
cd apps/api
bun run dev           # Modo desenvolvimento com hot reload
bun run build         # Build para produção
bun run start         # Executa build de produção

# Frontend (React Native + Web com Expo)
cd apps/frontend
npx expo start        # Inicia Expo dev server
npx expo start --web  # Inicia apenas para Web
npx expo run:android  # Build e roda no Android
npx expo run:ios      # Build e roda no iOS
```

## 🌐 URLs de Desenvolvimento

- **API**: http://localhost:3001
- **API Docs (Swagger)**: http://localhost:3001/swagger
- **Expo Web**: http://localhost:8081 (ou conforme Expo CLI)

## 🛠️ Troubleshooting

### Problema: CORS errors na web

**Solução**: Verifique se `EXPO_PUBLIC_API_URL` está apontando para `http://localhost:3001` e se a API está rodando.

### Problema: Porta já em uso

**Solução**: Altere `API_PORT` no `.env` ou pare o processo usando a porta:
```bash
# Linux/Mac
lsof -ti:3001 | xargs kill -9

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Problema: Expo Web não carrega

**Solução**:
1. Verifique se o Metro bundler está rodando
2. Limpe o cache: `cd apps/frontend && npx expo start --clear`
3. Verifique a URL da API no `.env`

### Problema: Database connection failed

**Solução**:
```bash
# Reiniciar containers
pnpm db:down
pnpm db:up

# Verificar se o PostgreSQL está rodando
docker ps | grep postgres
```

### Problema: Types não encontrados após codegen

**Solução**:
```bash
pnpm db:codegen
cd packages/db && pnpm build
```

## 🏗️ Tecnologias

- **Turborepo**: Orquestração do monorepo
- **pnpm**: Gerenciador de pacotes
- **TypeScript**: Type safety
- **Elysia**: Framework web para Bun
- **Expo**: Framework React Native + Web
- **Kysely**: Query builder SQL type-safe
- **PostgreSQL**: Database
- **React Native**: Mobile & Web UI

## 📦 Pacotes Compartilhados

- **@tms/config**: Configurações e env vars
- **@tms/db**: Client Kysely + migrations
- **@tms/ui**: Componentes React Native universais
- **@tms/tsconfig**: Configs TypeScript base
- **@tms/eslint-config**: Configs ESLint

## 🧪 Validação

```bash
# Type check completo
pnpm typecheck

# Lint completo
pnpm lint

# Build completo
pnpm build
```

## 📝 Notas

- O Bun é necessário apenas para `apps/api`
- Expo pode rodar com Node.js
- Todos os pacotes compartilhados usam workspace protocol
- Hot reload ativo em dev mode para API e Expo
