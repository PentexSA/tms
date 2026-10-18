import { defineConfig, devices } from '@playwright/test'
import { API_PORT, API_URL, DATABASE_URL, WEB_PORT, WEB_URL } from './env'

// E2E da jornada da v0 (doc/plano-v0.md §1) no export web do app. Antes:
// `pnpm -C e2e build:web` (exporta com a URL da API do E2E e confere o bundle).
const CI = !!process.env.CI

export default defineConfig({
  testDir: './tests',
  // Um banco para a rodada inteira: os testes não rodam em paralelo
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './global-setup.ts',
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: [
    {
      command: 'bun ../apps/api/src/server.ts',
      url: `${API_URL}/health`,
      // Sempre do zero: o rate limit em memória não acumula entre rodadas
      reuseExistingServer: false,
      env: {
        API_PORT: String(API_PORT),
        DATABASE_URL,
        CORS_ORIGINS: WEB_URL,
        NODE_ENV: 'development',
        // O E2E simula clientes diferentes pelo X-Forwarded-For (ver support/users.ts)
        TRUST_PROXY: 'true',
      },
    },
    {
      command: `bun serve-web.ts ../apps/frontend/dist ${WEB_PORT}`,
      url: WEB_URL,
      reuseExistingServer: !CI,
    },
  ],
})
