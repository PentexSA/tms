import baseConfig from '@tms/test-config/vitest.config.base'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject, mergeConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      // Setup file específico da API
      setupFiles: ['./src/test/setup.ts'],

      // Environment Node.js para testes de API
      environment: 'node',

      // Pool configuration para evitar race conditions com banco de dados
      // Executar testes em sequência para garantir isolamento
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@tms/config': resolve(__dirname, '../../packages/config/src'),
        '@tms/db': resolve(__dirname, '../../packages/db/src'),
      },
    },
  })
)
