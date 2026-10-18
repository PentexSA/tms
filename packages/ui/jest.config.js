const reactNative = require('@tms/jest-config/react-native')

module.exports = {
  ...reactNative,
  displayName: '@tms/ui',
  rootDir: '.',
  // Meta da v0 (doc/plano-v0.md §4)
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 80, statements: 80 },
  },
}
