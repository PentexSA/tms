const base = require('@tms/jest-config/base')

module.exports = {
  ...base,
  displayName: '@tms/ui',
  rootDir: '.',

  // Override for React Native type tests (no actual rendering)
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/src/**/*.spec.tsx',
  ],
}
