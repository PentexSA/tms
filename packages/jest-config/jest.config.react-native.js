/**
 * Base Jest configuration for React Native/Expo packages
 *
 * Used by:
 * - packages/ui (React Native components)
 * - apps/frontend (Expo app)
 *
 * Usage in your package's jest.config.js:
 * ```js
 * const rnConfig = require('@tms/jest-config/react-native')
 *
 * module.exports = {
 *   ...rnConfig,
 *   displayName: 'your-package-name',
 *   rootDir: '.',
 * }
 * ```
 */

module.exports = {
  preset: 'jest-expo',

  // Transform ignore patterns for React Native dependencies
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/*.test.{ts,tsx}',
    '<rootDir>/app/**/*.test.{ts,tsx}',
    '<rootDir>/src/__tests__/**/*.{ts,tsx}',
  ],

  // Module name mapper
  moduleNameMapper: {
    '^@tms/config$': '<rootDir>/../../packages/config/src',
    '^@tms/db$': '<rootDir>/../../packages/db/src',
    '^@tms/ui$': '<rootDir>/../../packages/ui/src',
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Coverage
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/node_modules/**',
    '!**/coverage/**',
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

  // Setup files (can be overridden in package config)
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],

  // Timeout
  testTimeout: 10000,

  // Behavior
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
}
