const reactNative = require('@tms/jest-config/react-native')

module.exports = {
  ...reactNative,
  displayName: '@tms/frontend',
  rootDir: '.',

  // Setup file for test utilities and mocks
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],

  // Test match patterns
  testMatch: [
    '<rootDir>/app/**/*.test.ts',
    '<rootDir>/app/**/*.test.tsx',
    '<rootDir>/app/**/*.spec.ts',
    '<rootDir>/app/**/*.spec.tsx',
    '<rootDir>/lib/**/*.test.ts',
    '<rootDir>/lib/**/*.test.tsx',
    '<rootDir>/components/**/*.test.tsx',
    '<rootDir>/sheet/**/*.test.ts',
    '<rootDir>/sheet/**/*.test.tsx',
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/test/**/*.test.tsx',
  ],

  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'sheet/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/__tests__/**',
  ],

  // Metas da v0 (doc/plano-v0.md §4): 80% no renderizador da ficha
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 60, statements: 70 },
    './sheet/': { lines: 80, functions: 80, branches: 70, statements: 80 },
  },

  // Mock static assets
  moduleNameMapper: {
    ...reactNative.moduleNameMapper,
    '^@tms/sheet-core$': '<rootDir>/../../packages/sheet-core/src',
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/test/__mocks__/fileMock.js',
    '\\.(css)$': '<rootDir>/test/__mocks__/styleMock.js',
  },
}
