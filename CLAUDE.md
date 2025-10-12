# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**API Routes**: Defined in `apps/api/src/index.ts` using Elysia with Swagger docs at `/swagger`.

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
npx pnpm test                      # Run all tests
```

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
- **Frontend**: Expo ~54.0 + Expo Router ~6.0 + React 19
- **Database**: PostgreSQL 16 via Docker
- **Query Builder**: Kysely v0.27 with kysely-codegen
- **TypeScript**: v5.7+ across all packages

## Troubleshooting

**Types not found after codegen**: Rebuild the db package with `cd packages/db && npx pnpm build`

**API won't start**: Ensure Bun is installed and PostgreSQL is running (`docker ps | grep postgres`)

**Expo cache issues**: Clear with `cd apps/frontend && npx expo start --clear`

**Database connection errors**: Verify Docker container is running and DATABASE_URL matches docker-compose.yml credentials

**Port conflicts**: Default ports are 3001 (API) and 5432 (PostgreSQL). Change in `.env` if needed.
