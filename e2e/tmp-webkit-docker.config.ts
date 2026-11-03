// WebKit via servidor de navegador no container oficial do Playwright
// (o WSL não tem as bibliotecas do sistema). Mesmos testes e servidores do
// e2e/playwright.config.ts, só o projeto webkit, conectado por WebSocket.
import { defineConfig, devices } from '@playwright/test'
import base from '/home/assisneto/tms/e2e/playwright.config'

const E2E = '/home/assisneto/tms/e2e'
const servers = Array.isArray(base.webServer) ? base.webServer : []

export default defineConfig({
  ...base,
  testDir: `${E2E}/tests`,
  globalSetup: `${E2E}/global-setup.ts`,
  outputDir:
    '/tmp/claude-1000/-home-assisneto-tms/e0db0ee4-aa78-4653-8903-223dec674c4d/scratchpad/webkit-results',
  webServer: servers.map(s => ({ ...s, cwd: E2E })),
  projects: [
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        connectOptions: {
          wsEndpoint: process.env.PW_WS ?? 'ws://127.0.0.1:3333/',
        },
      },
    },
  ],
})
