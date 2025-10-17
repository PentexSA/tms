import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config.base'

/**
 * Vitest configuration for UI/component packages (React/React Native)
 *
 * Used by:
 * - packages/ui (React Native components)
 * - apps/frontend (Expo app with React Native)
 *
 * Extends the base config with jsdom environment and UI-specific settings.
 *
 * Usage in your package's vitest.config.ts:
 * ```ts
 * import uiConfig from '@tms/test-config/vitest.config.ui'
 * import { defineConfig, mergeConfig } from 'vitest/config'
 *
 * export default mergeConfig(
 *   uiConfig,
 *   defineConfig({
 *     // Your custom config here
 *   })
 * )
 * ```
 */
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // Use jsdom environment for DOM APIs and React components
      environment: 'jsdom',

      // Test file patterns (includes .tsx for components)
      include: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.spec.ts',
        'src/**/*.spec.tsx',
        'src/__tests__/**/*.ts',
        'src/__tests__/**/*.tsx',
        'app/**/*.test.ts',
        'app/**/*.test.tsx',
        'app/__tests__/**/*.ts',
        'app/__tests__/**/*.tsx',
      ],

      // Coverage configuration for UI packages
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],

        // Slightly lower thresholds for UI tests (harder to achieve high coverage)
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 50,
          statements: 60,
        },

        // Exclude UI-specific patterns
        exclude: [
          'node_modules/',
          'dist/',
          'build/',
          '.frontend/',
          '**/*.test.ts',
          '**/*.test.tsx',
          '**/*.spec.ts',
          '**/*.spec.tsx',
          '**/*.config.ts',
          '**/*.config.js',
          '**/types.ts',
          '**/types/**',
          'src/test/**',
          'src/__tests__/**',
          'app/__tests__/**',
          // Expo/React Native specific
          'metro.config.js',
          'babel.config.js',
          'app/_layout.tsx', // Root layout often just setup
          '**/+html.tsx', // Expo Router web HTML template
        ],
      },

      // Setup files for @testing-library/react-native
      // Note: Override this in your package config to point to your setup file
      // setupFiles: ['./src/test/setup.ts'],
    },
  })
)
