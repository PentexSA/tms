/**
 * Configuração Root do Jest para o monorepo TMS
 *
 * Esta configuração orquestra todos os testes do monorepo usando
 * a funcionalidade de "projects" do Jest, que permite rodar testes
 * de múltiplos packages em paralelo.
 *
 * Cada package/app tem sua própria configuração Jest que é referenciada aqui.
 */

module.exports = {
  // Lista de projetos Jest a serem executados
  projects: [
    '<rootDir>/packages/config',
    '<rootDir>/packages/db',
    '<rootDir>/packages/ui',
    '<rootDir>/apps/api',
    '<rootDir>/apps/frontend',
  ],

  // Configurações globais
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    'apps/*/src/**/*.{ts,tsx}',
    'apps/frontend/app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/__tests__/**',
    '!**/__mocks__/**',
  ],

  // Diretório para saída de coverage consolidado
  coverageDirectory: '<rootDir>/coverage',

  // Thresholds globais de cobertura
  coverageThreshold: {
    global: {
      lines: 60,
      functions: 60,
      branches: 60,
      statements: 60,
    },
  },
}
