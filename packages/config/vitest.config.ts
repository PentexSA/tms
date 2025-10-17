import baseConfig from '@tms/test-config/vitest.config.base'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject, mergeConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      environment: 'node',
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  })
)
