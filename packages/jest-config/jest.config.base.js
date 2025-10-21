/**
 * Base Jest configuration for Node.js/backend packages
 *
 * Used by:
 * - apps/api (Elysia API)
 * - packages/db (Kysely + PostgreSQL)
 * - packages/config (Environment config)
 *
 * Usage in your package's jest.config.js:
 * ```js
 * const base = require('@tms/jest-config/base')
 *
 * module.exports = {
 *   ...base,
 *   displayName: 'your-package-name',
 *   rootDir: '.',
 * }
 * ```
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Paths
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/src/__tests__/**/*.ts',
  ],

  // TypeScript
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'esnext',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
        },
      },
    ],
  },

  // Transform @tms/* packages (monorepo dependencies) and PGLite
  transformIgnorePatterns: ['node_modules/(?!(@tms|@electric-sql)/)'],

  // ESM support for PGLite
  extensionsToTreatAsEsm: ['.ts'],

  // Module resolution
  moduleNameMapper: {
    '^@tms/config/env$': '<rootDir>/../../packages/config/src/env.ts',
    '^@tms/config$': '<rootDir>/../../packages/config/src',
    '^@tms/db$': '<rootDir>/../../packages/db/src',
    '^@tms/ui$': '<rootDir>/../../packages/ui/src',
  },

  // Coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/test/**',
    '!src/__tests__/**',
    '!src/types.ts',
    '!src/**/*.d.ts',
  ],

  coverageThreshold: {
    global: {
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60,
    },
  },

  coverageReporters: ['text', 'json', 'html', 'lcov'],

  // Performance
  maxWorkers: '50%',

  // Behavior
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Timeout
  testTimeout: 10000,
}
