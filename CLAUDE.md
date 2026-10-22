# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goal

TMS is a tabletop RPG character sheet manager. It is meant to support any game system, but the current version focuses on **World of Darkness (WoD)** (Storyteller System terminology: chronicles, storytellers, characters).

Domain model (see `doc/database.dbml`):

- `users`: players and storytellers
- `game_systems`: supported RPG systems (`family` groups related systems/editions)
- `chronicles`: campaigns, each with a `storyteller_id` and a `system_id`
- `characters`: a user's character in a chronicle; sheet values stored in `sheet_data` (jsonb)
- `trait_templates`: per-system sheet structure in `template_data` (jsonb)

Keep the data model system-agnostic: sheet structure comes from `trait_templates`, not hardcoded WoD columns. Adding a new system should not require a migration.

## Architecture Overview

This is a Turborepo monorepo with:

- **API**: Elysia (Bun runtime) REST API in `apps/api`
- **Frontend**: Expo (React Native + Web) with Expo Router in `apps/frontend`
- **Database**: PostgreSQL with Kysely query builder + migrations
- **Shared packages**: Config, DB client, UI components, TypeScript/ESLint configs

### Workspace Structure

```
apps/
  api/          - Elysia API (requires Bun)
  frontend/     - Expo app (React Native + Web)
packages/
  config/       - Environment variables and config (@tms/config)
  db/           - Kysely client, migrations, codegen (@tms/db)
  ui/           - Universal React Native components (@tms/ui)
  eslint-config/
  tsconfig/
```

### Key Architecture Patterns

**Workspace Dependencies**: All internal packages use `workspace:*` protocol in package.json. Shared packages are imported as `@tms/config`, `@tms/db`, `@tms/ui`.

**Database Layer**: Kysely provides type-safe SQL queries. The DB schema is defined in migrations (`packages/db/src/migrations/*.ts`). After schema changes, run `npx pnpm db:codegen` to regenerate TypeScript types in `packages/db/src/types.ts`.

**Environment Variables**: Centralized in `@tms/config` package (`packages/config/src/env.ts`). Provides defaults for DATABASE_URL, API_PORT, and EXPO_PUBLIC_API_URL.

**API Routes**: Defined in `apps/api/src/index.ts` (`createApp`, no `.listen`) using Elysia with Swagger docs at `/swagger`. `apps/api/src/server.ts` is the server entry point.

**Frontend Navigation**: Uses Expo Router (file-based routing) in `apps/frontend/app/`.

## Development Commands

### Initial Setup

```bash
npx pnpm install                    # Install all dependencies
cp .env.example .env           # Copy environment template
npx pnpm db:up                     # Start PostgreSQL via Docker
npx pnpm db:migrate                # Run migrations
npx pnpm db:codegen                # Generate TypeScript types from DB schema
```

### Development

```bash
npx pnpm dev                       # Start all apps in parallel
npx pnpm dev:expo                  # Start only frontend

# Individual apps
cd apps/api && bun run dev     # API only (hot reload)
cd apps/frontend && npx expo start  # Frontend only
```

### Database Operations

```bash
npx pnpm db:up                     # Start PostgreSQL container
npx pnpm db:down                   # Stop and remove PostgreSQL + volumes
npx pnpm db:migrate                # Run migrations (up)
npx pnpm db:codegen                # Regenerate types from schema
cd packages/db && npx pnpm migrate:down  # Rollback last migration
```

### Quality Checks

```bash
npx pnpm typecheck                 # Type check all packages
npx pnpm lint                      # Lint all packages
npx pnpm build                     # Build all packages
npx pnpm test                      # Run all tests (hybrid: Bun + Jest)
```

### Testing

The project uses a **hybrid test setup** for optimal performance and compatibility:

**Backend (Bun Test Runner)** - Fast, no Docker needed:
```bash
npx pnpm test:packages             # All backend packages (@tms/config, @tms/db, @tms/api)
bun test packages/config/src/__tests__      # Test specific package
bun test --watch                   # Watch mode for development
```

**Frontend/UI (Jest)** - React Native compatibility:
```bash
npx pnpm test:ui                   # Test @tms/ui and frontend
npm run test --filter=@tms/ui      # Test only UI package
```

**All Tests**:
```bash
npx pnpm test                      # Runs Bun (backend) + Jest (frontend)
```

#### Key Features

- **@tms/sheet-core**: ~660 tests (Bun), incluindo property tests (fast-check)
- **@tms/api**: ~330 tests (Bun) em PGLite, com a matriz de AuthZ de todas as rotas
- **@tms/db**: ~19 tests (Bun): migrations sobem e descem
- **@tms/ui**: ~89 tests (Jest)
- **frontend**: ~520 tests (Jest + React Native Testing Library)
- Metas de cobertura por pacote (`bunfig.toml` e `jest.config.js`), aplicadas no CI

#### E2E (Playwright, Chromium e WebKit)

Roda contra o export web servido com a CSP de produção (`dist/_headers`) e uma API real num Postgres descartável:

```bash
npx pnpm build && npx pnpm -C e2e build:web
E2E_DATABASE_URL=postgres://postgres:postgres@localhost:5432/tms_e2e npx pnpm -C e2e test:e2e
```

`journey.spec.ts` é a jornada inteira da v0 (doc/plano-v0.md §1), `journey-mage.spec.ts`, a da v1 (doc/plano-v1.md §1), e `journey-werewolf.spec.ts`, a da v2 (doc/plano-v2.md §1). O seed publica os templates do produto (`pnpm templates:publish --published`). Portas fixas (API 3101, web 8181): não rode dois E2E ao mesmo tempo.

#### Concorrência em Postgres real

O PGLite tem uma conexão só; o `FOR UPDATE` só se prova num Postgres de verdade (job `postgres` do CI). O banco precisa terminar em `_test` (o teste apaga o schema):

```bash
cd apps/api
PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_events_test bun test src/__tests__/events.pg.test.ts
PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_rolls_test bun test src/rolls/__tests__/rolls.pg.test.ts
PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_policy_test bun test src/__tests__/policy.pg.test.ts
PG_TEST_URL=postgres://postgres:postgres@localhost:5432/tms_members_test bun test src/__tests__/members.pg.test.ts
```

#### Test Infrastructure

- **Bun Test Runner**: Backend packages use native Bun for ~70% faster execution
- **PGLite**: In-memory PostgreSQL for isolated, fast database tests (no Docker), from `@tms/db/testing` (never from the main `@tms/db` entry)
- **Jest**: Frontend packages use Jest for React Native/Expo compatibility
- **@tms/bun-test-config**: Shared Bun test utilities and helpers

No NODE_OPTIONS workarounds needed anymore!

### Individual Package Commands

```bash
# API (must use Bun)
cd apps/api
bun run dev                    # Development with hot reload
bun run build                  # Production build
bun run start                  # Run production build

# Frontend
cd apps/frontend
npx expo start                 # Start dev server
npx expo start --web           # Web only
npx expo start --clear         # Clear cache
npx expo run:android           # Build and run Android
npx expo run:ios               # Build and run iOS (macOS only)

# Database package
cd packages/db
npx pnpm build                     # Compile TypeScript
npx pnpm migrate:up                # Run migrations
npx pnpm migrate:down              # Rollback migration
npx pnpm codegen                   # Generate types
```

## Workflow Guidelines

**Adding Database Schema Changes**:

1. Create new migration in `packages/db/src/migrations/` following pattern `XXXX_description.ts`
2. Run `npx pnpm db:migrate` to apply migration
3. Run `npx pnpm db:codegen` to regenerate types
4. Rebuild db package: `cd packages/db && npx pnpm build`

**Adding API Routes**:

- Edit `apps/api/src/index.ts`
- Import and use `db` from `@tms/db`
- Use Elysia's chainable API pattern
- Swagger automatically updates at `/swagger`

**Shared Package Changes**:

- After modifying shared packages (`@tms/config`, `@tms/db`, `@tms/ui`), rebuild them with `npx pnpm build` or individual package `npx pnpm build`
- Turborepo handles build order via `dependsOn` in `turbo.json`

**Environment Variables**:

- API and DB packages: use process.env directly or import from `@tms/config`
- Expo frontend: must prefix with `EXPO_PUBLIC_` to be available in app

## Technical Stack

- **Package Manager**: pnpm with hoisted node_modules
- **Monorepo Tool**: Turborepo v2.5+
- **Runtime**: Bun (API only), Node.js (other packages)
- **API Framework**: Elysia v1.2+ with @elysiajs/cors and @elysiajs/swagger
- **Frontend**: Expo ~57.0 + Expo Router ~57.0 + React 19.2 (React Native 0.86)
- **Database**: PostgreSQL 16 via Docker
- **Query Builder**: Kysely v0.28 with kysely-codegen
- **TypeScript**: v5.7+ across all packages

## Troubleshooting

**Types not found after codegen**: Rebuild the db package with `cd packages/db && npx pnpm build`

**API won't start**: Ensure Bun is installed and PostgreSQL is running (`docker ps | grep postgres`)

**Expo cache issues**: Clear with `cd apps/frontend && npx expo start --clear`

**Database connection errors**: Verify Docker container is running and DATABASE_URL matches docker-compose.yml credentials

**Port conflicts**: Default ports are 3001 (API) and 5432 (PostgreSQL). Change in `.env` if needed.
