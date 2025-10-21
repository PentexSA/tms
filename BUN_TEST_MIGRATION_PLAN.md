# Bun Test Runner Migration Plan

## Overview
Migrate from Jest to Bun's native test runner to:
- Eliminate Node.js `NODE_OPTIONS` workarounds for PGLite
- Leverage Bun's superior performance and native ESM/WASM support
- Maintain consistent testing across the monorepo
- migrate expo to use bun: https://docs.expo.dev/guides/using-bun/

---

## Current State

### Jest Setup
- **Test runner**: Jest with ts-jest preset
- **Config files**:
  - `packages/jest-config/jest.config.base.js` (Node.js packages)
  - `packages/jest-config/jest.config.react-native.js` (React Native/Expo)
- **Scripts**: `npm run test` via turbo
- **Issue**: Requires `NODE_OPTIONS='--experimental-vm-modules'` for PGLite

### Bun Advantages
- ✅ Native ESM/WASM support (no flags needed)
- ✅ ~4x faster than Node.js
- ✅ Built-in TypeScript support
- ✅ No Jest configuration needed for basic tests
- ❌ Limited React Native/Expo support (may need fallback to Jest)

---

## Phase 1: Setup & Research (1-2 hours)

### 1.1 Investigate Bun Test Compatibility

**Action Items**:
- [ ] Review [Bun Test API](https://bun.sh/docs/test)
- [ ] migrate expo to use bun: https://docs.expo.dev/guides/using-bun/
- [ ] Test Bun test with TypeScript files
- [ ] Check Bun support for:
  - [ ] ESM imports
  - [ ] CommonJS compatibility
  - [ ] Module mocking (jest.mock vs Bun equivalent)
  - [ ] Test isolation
  - [ ] Setup/teardown hooks

**Expected Findings**:
```
Bun Test API:
- describe(name, fn)
- it(name, fn)
- test(name, fn) - alias for it
- expect(value).toEqual(value)
- beforeAll, afterAll, beforeEach, afterEach
- mock(modulePath) for mocking
```

### 1.2 Create Bun Test Configuration

**Files to Create**:
- `bunfig.toml` (optional, at root) - Bun config file
- `packages/*/bunfig.toml` (optional, per-package)

**Sample Configuration** (minimal):
```toml
[test]
# Bun auto-discovers test files
root = "src"
preload = ["./src/test/setup.ts"]
```

### 1.3 Create Test Helper Library

**File**: `packages/bun-test-config/index.ts`
- Centralized test utilities for Bun
- Replace Jest-specific APIs
- Export common setup functions

**Exports**:
```typescript
export { describe, it, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
export { mock } from 'bun:test';
// Custom helpers
export { createTestDatabase } from './helpers';
```

---

## Phase 2: Adapt Existing Tests (3-4 hours)

### 2.1 Priority Order (least to most complex)

| Priority | Package | Reason | Migration Time |
|----------|---------|--------|-----------------|
| 1 | @tms/config | No dependencies, simple | 30 min |
| 2 | @tms/db | Core + PGLite, but isolated | 1 hour |
| 3 | @tms/api | Uses @tms/db + Elysia | 1 hour |
| 4 | @tms/ui | React Native - may need Jest | 1-2 hours |
| 5 | frontend | Expo - likely needs Jest fallback | 1-2 hours |

### 2.2 Config Package Migration

**File**: `packages/config/src/__tests__/env.test.ts`

**Changes**:
```typescript
// Before (Jest)
describe('Config', () => {
  test('should load env vars', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });
});

// After (Bun)
import { describe, it, expect } from 'bun:test';

describe('Config', () => {
  it('should load env vars', () => {
    expect(process.env.DATABASE_URL).toBeDefined();
  });
});
```

**Steps**:
1. Replace import source: `jest` → `bun:test`
2. Replace `test()` → `it()` (or keep `test()`, both work)
3. Remove Jest-specific matchers if any
4. Test: `bun test`

### 2.3 DB Package Migration

**Files to Update**:
- `packages/db/src/__tests__/client.test.ts`
- `packages/db/src/__tests__/pglite-setup.test.ts`

**Key Changes**:
```typescript
// Imports
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

// Mocking (different from Jest)
// Jest: jest.mock('@module/path')
// Bun: import.meta.mock() or custom mocking

// PGLite setup
import { PGlite } from '@electric-sql/pglite';

describe('Database Client', () => {
  let db: Kysely<Database>;
  let pglite: PGlite;

  beforeAll(async () => {
    // PGLite now works WITHOUT NODE_OPTIONS ✨
    pglite = new PGlite();
    db = setupKyselyWithPGlite(pglite);
  });

  afterAll(async () => {
    await pglite.close();
  });
});
```

**Advantages**:
- ✅ No `NODE_OPTIONS` needed
- ✅ PGLite works natively
- ✅ Faster startup time

### 2.4 API Package Migration

**File**: `apps/api/src/__tests__/api.test.ts`

**Special Handling for Elysia**:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { PGlite } from '@electric-sql/pglite';

describe('API Routes', () => {
  let app: Elysia;
  let pglite: PGlite;

  beforeEach(async () => {
    pglite = new PGlite();
    const db = createKyselyWithPGlite(pglite);

    app = new Elysia()
      .derive(() => ({ db }))
      .post('/users', ({ db, body }) => {
        // Your route handler
      });
  });

  afterEach(async () => {
    await pglite.close();
  });

  it('should create user', async () => {
    const response = await app.handle(
      new Request('http://localhost/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'John' }),
      })
    );
    expect(response.status).toBe(201);
  });
});
```

**Notes**:
- Elysia app can be tested via `app.handle(request)`
- No need for supertest or similar
- Bun has native Request/Response handling

### 2.5 UI Package Migration (React Native)

**Challenge**: Jest has better React Native support via jest-expo preset.

**Options**:

#### Option A: Keep Jest for UI/Expo
```typescript
// packages/ui/jest.config.js - Keep as is
// apps/frontend/jest.config.js - Keep as is
```
- Use Jest for React Native
- Use Bun for everything else
- Hybrid approach

#### Option B: Migrate to Bun + Custom Rendering
```typescript
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react-native';
import { Button } from './Button';

describe('Button Component', () => {
  it('should render button', () => {
    render(<Button />);
    expect(screen.getByText('Press me')).toBeDefined();
  });
});
```
- Requires testing-library/react-native compatibility
- May have limitations
- Worth attempting but fallback to Jest if issues

**Recommendation**: Option A (Hybrid) - Keep Jest for UI/Expo, use Bun for backend

---

## Phase 3: Update Configuration & Scripts (1-2 hours)

### 3.1 Create bunfig.toml (Optional)

**File**: `/home/assisneto/tms/bunfig.toml`

```toml
[test]
# Test environment settings
root = "packages"
timeout = 10000

# Preload setup files
preload = []
```

### 3.2 Update Test Scripts

**File**: `package.json`

**Before (Jest with NODE_OPTIONS)**:
```json
{
  "scripts": {
    "test": "cross-env NODE_OPTIONS='--experimental-vm-modules --no-warnings' turbo run test",
    "test:watch": "cross-env NODE_OPTIONS='--experimental-vm-modules --no-warnings' turbo run test:watch"
  }
}
```

**After (Bun native)**:
```json
{
  "scripts": {
    "test": "turbo run test",
    "test:watch": "turbo run test:watch",
    "test:api": "turbo run test --filter=@tms/api",
    "test:packages": "turbo run test --filter='./packages/*'",
    "test:ui": "turbo run test --filter='./packages/ui' && turbo run test --filter=frontend"
  }
}
```

### 3.3 Update Individual Package Test Scripts

**Files**: `apps/*/package.json`, `packages/*/package.json`

```json
{
  "scripts": {
    "test": "bun test --preload ./src/test/setup.ts",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

**Package-specific**:
- **@tms/config**: `bun test src/__tests__/*.ts`
- **@tms/db**: `bun test src/__tests__/*.ts --preload src/test/setup.ts`
- **@tms/api**: `bun test src/__tests__/*.ts`
- **@tms/ui**: `jest` (keep Jest for now)
- **frontend**: `jest` (keep Jest for now)

### 3.4 Remove Jest Configuration Files

**Files to Delete**:
- [ ] `packages/jest-config/jest.config.base.js`
- [ ] `packages/jest-config/jest.config.react-native.js`
- [ ] `packages/jest-config/package.json`
- [ ] `jest.config.js` (root)

**Files to Migrate**:
- [ ] Keep Jest config for UI/Expo packages (for now)

### 3.5 Update turbo.json

**Before**:
```json
{
  "tasks": {
    "test": {
      "outputs": ["coverage/**", "reports/**"],
      "cache": false
    }
  }
}
```

**After** (no changes needed - turbo will auto-detect bun test):
```json
{
  "tasks": {
    "test": {
      "outputs": ["coverage/**", "reports/**"],
      "cache": false
    }
  }
}
```



## Phase 5: Testing & Validation (1 hour)

### 5.1 Local Testing

```bash
# Test each package individually
bun test packages/config/src/__tests__
bun test packages/db/src/__tests__
bun test apps/api/src/__tests__

# Test UI/Frontend with Jest (fallback)
npm run test -- --filter='@tms/ui'
npm run test -- --filter=frontend
```

### 5.2 Performance Benchmarking

Compare Jest vs Bun execution times:

| Package | Jest (with NODE_OPTIONS) | Bun | Improvement |
|---------|--------------------------|-----|-------------|
| @tms/config | 5-8s | 1-2s | 60-75% ↓ |
| @tms/db | 10-15s | 3-5s | 60-70% ↓ |
| @tms/api | 12-18s | 4-7s | 60-65% ↓ |

## Phase 6: Documentation & Cleanup (30 min)

### 6.1 Update CLAUDE.md

```markdown
## Testing

### Running Tests

**Backend & Database** (uses Bun):
```bash
bun test
npm run test:packages
```

**Frontend & UI** (uses Jest):
```bash
npm run test:ui
```

### PGLite In-Memory Database
Tests use PGLite for fast, isolated database tests:
- No Docker needed
- Each test gets fresh database
- Runs in-process
- ~60% faster than Jest
```

### 6.2 Create BUNTESTS.md

Document:
- How to write tests with Bun
- Mocking patterns
- API routes testing with Bun/Elysia
- Database testing with PGLite

### 6.3 Clean Up

- [ ] Delete Jest config files
- [ ] Remove `cross-env` from dependencies (if not used elsewhere)
- [ ] Remove `jest` from devDependencies
- [ ] Update .gitignore (remove .jest-cache)
- [ ] Remove NODE_OPTIONS from test scripts

---

## Implementation Timeline

| Phase | Duration | Owner |
|-------|----------|-------|
| Phase 1: Setup & Research | 1-2 h | You |
| Phase 2: Adapt Tests | 3-4 h | You |
| Phase 3: Config & Scripts | 1-2 h | You |
| Phase 4: CI/CD | 30 min | You |
| Phase 5: Testing & Validation | 1 h | You |
| Phase 6: Documentation | 30 min | You |
| **Total** | **7-11 h** | |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| React Native tests fail | Keep Jest for UI/Expo (hybrid approach) |
| Bun test API differs | Small differences, easy to adapt |
| CI/CD breaks | Test locally first, then push |
| Performance regression | Benchmark before/after, analyze if needed |

---

## Success Criteria

- ✅ All backend tests pass with Bun
- ✅ UI/Expo tests pass with Jest (fallback)
- ✅ NO `NODE_OPTIONS` needed in scripts
- ✅ PGLite works without special flags
- ✅ Test execution ~60% faster
- ✅ CI/CD faster (no Docker PostgreSQL)
- ✅ Documentation updated
- ✅ Developers understand hybrid Jest/Bun setup

---

## Optional Future Improvements

1. **Parallel Test Execution**: Bun supports parallel tests natively
2. **Test Coverage**: Bun has native coverage support
3. **Snapshot Testing**: Implement Bun-compatible snapshot system
4. **E2E Tests**: Consider using Bun for E2E tests too
5. **Full React Native Migration**: If Bun improves RN support

---

## Decision Points

**Decision 1**: Keep Jest for UI/Expo or force Bun?
- **Recommendation**: Hybrid approach (Jest for UI, Bun for backend)

**Decision 2**: Update CI immediately or gradual rollout?
- **Recommendation**: Local testing first, then CI update

**Decision 3**: Remove Node.js from Docker setup?
- **Recommendation**: Keep both Bun & Node.js in CI for compatibility
