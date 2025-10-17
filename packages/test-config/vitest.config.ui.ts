import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Base Vitest configuration for UI/frontend packages with React Native
 *
 * Used by:
 * - packages/ui (React Native components)
 * - apps/frontend (Expo app) - future
 *
 * Extend this config in your package's vitest.config.ts:
 * ```ts
 * import uiConfig from '@tms/test-config/vitest.config.ui'
 * import { defineConfig, mergeConfig } from 'vitest/config'
 *
 * export default mergeConfig(
 *   uiConfig,
 *   defineConfig({
 *     // Your custom config here
 *   })
 * )
 * ```
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],

      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },

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

    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.test.tsx', 'src/**/*.spec.tsx', 'src/__tests__/**/*.ts', 'src/__tests__/**/*.tsx'],

    exclude: ['node_modules', 'dist', 'build', '.frontend', 'coverage'],

    testTimeout: 10000,
    hookTimeout: 10000,

    retry: 1,

    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },

  resolve: {
    alias: {
      '@tms/config': resolve(__dirname, '../../packages/config/src'),
      '@tms/db': resolve(__dirname, '../../packages/db/src'),
      '@tms/ui': resolve(__dirname, '../../packages/ui/src'),
    },
  },
})
