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
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/test/**/*.test.tsx',
  ],

  // Mock static assets
  moduleNameMapper: {
    ...reactNative.moduleNameMapper,
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/test/__mocks__/fileMock.js',
    '\\.(css)$': '<rootDir>/test/__mocks__/styleMock.js',
  },
}
