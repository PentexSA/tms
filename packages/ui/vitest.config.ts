import uiConfig from '@tms/test-config/vitest.config.ui'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject, mergeConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
  uiConfig,
  defineProject({
    test: {
      setupFiles: ['./src/test/setup.ts'],
      environment: 'jsdom',
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        'react-native$': 'react-native-web',
      },
    },

    server: {
      deps: {
        inline: ['react-native', 'react-native-web'],
      },
    },
  })
)
