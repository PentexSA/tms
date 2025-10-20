const base = require('@tms/jest-config/base')

module.exports = {
  ...base,
  displayName: '@tms/api',
  rootDir: '.',

  // Setup file for import.meta mock and global setup
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],

  // Mock ESM modules that are not compatible with Jest
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '@elysiajs/swagger': '<rootDir>/src/test/__mocks__/swagger.ts',
  },

  // Override transformIgnorePatterns to transform ESM modules
  transformIgnorePatterns: ['node_modules/(?!(@tms|@elysiajs)/)'],

  // Override transform to add isolatedModules for faster tests
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
        },
        // Add globals to mock import.meta
        globals: {
          'import.meta': { main: false },
        },
      },
    ],
  },
}
