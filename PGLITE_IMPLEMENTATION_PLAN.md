# PGLite Integration Plan for In-Memory Database Testing

## Overview
Integrate PGLite (WebAssembly PostgreSQL) to provide fast, isolated in-memory databases for testing. This reduces test execution time and eliminates external dependencies.

## Phase 1: Setup & Dependencies

### 1.1 Add PGLite Package
- **File**: `pnpm-lock.yaml`, `package.json`
- **Action**: Add `@electric-sql/pglite` to root `package.json`
  ```bash
  npx pnpm add -w @electric-sql/pglite
  ```
- **Expected**: ~3MB gzipped, supports Postgres 15 features

### 1.2 Update TypeScript Configuration
- **File**: `packages/jest-config/jest.config.react-native.js`
- **Action**: Add ESM/WASM support:
  ```javascript
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@electric-sql/pglite$': '<rootDir>/../../node_modules/@electric-sql/pglite/dist/index.js',
  },
  ```

---

## Phase 2: Database Fixture Creation

### 2.1 Create PGLite Test Helper Module
- **File**: `packages/db/src/test/pglite-setup.ts` (NEW)
- **Purpose**: Initialize and manage PGLite instance per test
- **Key Features**:
  - Factory function to create fresh PGLite instance
  - Apply all migrations on startup
  - Cleanup after test
  - Connection pooling simulation

**Pseudo-code**:
```typescript
import { PGlite } from '@electric-sql/pglite';
import { Kysely, PostgresDialect } from 'kysely';

export async function createTestDatabase() {
  const pglite = new PGlite();

  // Apply migrations
  await runMigrations(pglite);

  // Create Kysely instance
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new PGlitePool(pglite),
    }),
  });

  return { db, pglite };
}

export async function cleanupTestDatabase(db: Kysely, pglite: PGlite) {
  await db.destroy();
  await pglite.close();
}
```

### 2.2 Update Test Setup File
- **File**: `packages/db/src/test/setup.ts`
- **Action**: Integrate PGLite initialization
  - Add `beforeAll` hook to create PGLite instance
  - Add `afterEach` hook to clear tables
  - Add `afterAll` hook to cleanup

---

## Phase 3: Migrations Integration

### 3.1 Create Migration Runner for PGLite
- **File**: `packages/db/src/test/run-migrations.ts` (NEW)
- **Purpose**: Execute SQL migrations against PGLite
- **Implementation**:
  - Read migration files from `packages/db/src/migrations/`
  - Execute sequentially on PGLite instance
  - Track applied migrations in `schema_migrations` table

**Key consideration**: PGLite doesn't have a built-in migration runner like Flyway, so we need to:
1. Read migration files as strings
2. Execute raw SQL against PGLite
3. Store applied version in metadata table

### 3.2 Update Existing Migrations
- **Files**: `packages/db/src/migrations/*.ts`
- **Action**: Ensure all migrations are compatible with PGLite
  - Check for unsupported Postgres extensions
  - Verify UUID support (built-in)
  - Test timestamp/timezone handling

---

## Phase 4: Adapt Existing Tests

### 4.1 Update Config Package Tests
- **File**: `packages/config/src/__tests__/env.test.ts`
- **Changes**: Already isolated, minimal changes needed
- **Note**: Doesn't depend on database, no changes required

### 4.2 Update DB Package Tests
- **File**: `packages/db/src/__tests__/client.test.ts`
- **Changes**:
  1. Replace hardcoded `DATABASE_URL` with PGLite connection
  2. Use test fixture from `pglite-setup.ts`
  3. Add tests for common queries:
     - User creation/fetch
     - Relationships (chronicles → characters)
     - Transaction handling
     - Query type safety

**Test structure**:
```typescript
describe('Database Client', () => {
  let db: Kysely<Database>;
  let pglite: PGlite;

  beforeAll(async () => {
    ({ db, pglite } = await createTestDatabase());
  });

  afterAll(async () => {
    await cleanupTestDatabase(db, pglite);
  });

  afterEach(async () => {
    // Truncate all tables
    await db.deleteFrom('characters').execute();
    await db.deleteFrom('chronicles').execute();
    // ... etc
  });

  test('should create and fetch user', async () => {
    // Test implementation
  });
});
```

### 4.3 Update API Tests
- **File**: `apps/api/src/__tests__/api.test.ts`
- **Changes**:
  1. Initialize PGLite in test setup
  2. Mock Elysia `db` context with PGLite instance
  3. Test actual API routes against in-memory DB
  4. Seed test data in `beforeEach`

**Note**: May need to create `apps/api/src/test/pglite-setup.ts` wrapper specific to Bun/Elysia

### 4.4 Update UI Package Tests
- **File**: `packages/ui/src/__tests__/*.test.tsx`
- **Impact**: Minimal - UI tests don't interact with database
- **No changes needed**

---

## Phase 5: CI/CD Integration

### 5.1 Update Test Scripts
- **File**: `package.json`
- **Action**: Add environment variable for test mode
  ```json
  {
    "scripts": {
      "test": "cross-env NODE_ENV=test jest",
      "test:watch": "cross-env NODE_ENV=test jest --watch"
    }
  }
  ```

### 5.2 GitHub Actions / CI Pipeline
- **Files**: `.github/workflows/*.yml`
- **Changes**:
  - PGLite runs in-process, no Docker needed
  - Remove `services.postgres` from CI config
  - Faster test execution (no container overhead)

---

## Phase 6: Optional Enhancements

### 6.1 Seed Data Factory
- **File**: `packages/db/src/test/seeds.ts` (NEW)
- **Purpose**: Factory functions for common test data
  ```typescript
  export async function seedUser(db: Kysely, overrides?: Partial<User>) {
    return db.insertInto('users').values({
      id: uuid(),
      email: 'test@example.com',
      ...overrides,
    }).returningAll().executeTakeFirstOrThrow();
  }
  ```

### 6.2 Performance Benchmarking
- **File**: `packages/db/src/__tests__/performance.bench.ts`
- **Purpose**: Compare PGLite vs Docker PostgreSQL startup times
  - Expected PGLite: ~50-200ms per test
  - Expected Docker: ~500ms+ per test

### 6.3 Parallel Test Execution
- **File**: `jest.config.js`
- **Enhancement**: With isolated PGLite instances, can safely run tests in parallel
  ```javascript
  module.exports = {
    maxWorkers: '50%', // Use multiple workers
  };
  ```

---

## Implementation Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Setup & Dependencies | 30 min | 🔴 Critical |
| Phase 2: Database Fixture | 1-2 hours | 🔴 Critical |
| Phase 3: Migrations Integration | 1-2 hours | 🔴 Critical |
| Phase 4: Adapt Existing Tests | 2-3 hours | 🟡 High |
| Phase 5: CI/CD Integration | 1 hour | 🟡 High |
| Phase 6: Optional Enhancements | 2-3 hours | 🟢 Low |

**Total estimated time**: 8-12 hours

---

## Success Criteria

- ✅ All tests pass with PGLite
- ✅ Test execution time reduced by 50%+
- ✅ No Docker dependency for local testing
- ✅ CI/CD pipeline faster (no container startup)
- ✅ Tests can run in parallel safely
- ✅ Type safety maintained with Kysely

---

## Potential Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| PGLite extension compatibility | Use standard Postgres features, test early |
| WASM module loading in Jest | Configure ESM/WASM in jest.config.js |
| Connection pooling simulation | Implement simple queue or mock Pool class |
| Migration version tracking | Create `schema_migrations` table, track manually |
| Parallel test isolation | Each test gets fresh PGLite instance |

---

## Rollback Plan

If issues arise:
1. Keep existing Docker PostgreSQL setup
2. Add environment variable: `USE_PGLITE=true` to opt-in
3. Fallback to Docker if PGLite fails
4. Gradual rollout: Start with DB package, then API tests

---

## References

- PGLite Docs: https://pglite.dev/docs/about
- Kysely + PGLite: Check compatibility layer
- Jest WASM Support: https://jestjs.io/docs/ecmascript-modules
