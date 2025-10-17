import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Base Vitest configuration for Node.js/backend packages
 *
 * Used by:
 * - apps/api (Elysia API)
 * - packages/db (Kysely + PostgreSQL)
 * - packages/config (Environment config)
 *
 * Extend this config in your package's vitest.config.ts:
 * ```ts
 * import baseConfig from '@tms/test-config/vitest.config.base'
 * import { defineConfig, mergeConfig } from 'vitest/config'
 *
 * export default mergeConfig(
 *   baseConfig,
 *   defineConfig({
 *     // Your custom config here
 *   })
 * )
 * ```
 */
export default defineConfig({
  test: {
    // Enable globals (describe, it, expect, etc.) without imports
    globals: true,

    // Node environment for backend/API tests
    environment: 'node',

    // Coverage configuration with v8 provider
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      // Coverage thresholds (initial pragmatic targets)
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },

      // Exclude common patterns from coverage
      exclude: [
        'node_modules/',
        'dist/',
        'build/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.config.ts',
        '**/*.config.js',
        '**/types.ts',
        '**/types/**',
        'src/test/**',
        'src/__tests__/**',
      ],
    },

    // Test file patterns
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/__tests__/**/*.ts'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', 'build', '.frontend', 'coverage'],

    // Timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,

    // Retry failed tests once to handle flaky tests
    retry: 1,

    // Clear mocks between tests
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },

  // Resolve aliases for @tms/* packages
  // Note: These should be overridden in each package's config
  // to point to the correct relative paths
  resolve: {
    alias: {
      '@tms/config': resolve(__dirname, '../../packages/config/src'),
      '@tms/db': resolve(__dirname, '../../packages/db/src'),
      '@tms/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
})
