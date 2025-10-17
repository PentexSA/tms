import baseConfig from '@tms/test-config/vitest.config.base'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, mergeConfig } from 'vitest/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Setup file específico da API
      setupFiles: ['./src/test/setup.ts'],

      // Environment Node.js para testes de API
      environment: 'node',

      // Opcional: rodar testes em sequência para evitar conflitos de DB
      // Descomente se tiver problemas com testes paralelos
      // pool: 'forks',
      // poolOptions: { forks: { singleFork: true } },
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
