import { treaty } from '@elysiajs/eden'
import { Elysia } from 'elysia'
import { type App, createApp } from '../index'
import { clearTestDb, createTestDb } from './db'

// Global test state for managing DB lifecycle
let testDbInstance: any = null
let testDbCleanup: (() => Promise<void>) | null = null

/**
 * Cria uma instância de teste da aplicação Elysia com PGLite database
 *
 * IMPORTANTE: Não chama .listen() para não abrir porta real
 * Usa um banco de dados em memória (PGLite) isolado para testes
 *
 * @example
 * const app = createTestApp()
 * const response = await app.handle(new Request('http://localhost/health'))
 */
export async function createTestApp() {
  // Create new test DB for each test to ensure isolation
  const { db, destroy } = await createTestDb()
  testDbInstance = db
  testDbCleanup = destroy

  return createApp(db)
}

/**
 * Faz uma requisição HTTP de teste para a aplicação
 *
 * @example
 * const response = await makeRequest(app, 'GET', '/health')
 * expect(response.status).toBe(200)
 *
 * Note: Uses 'any' for app parameter to avoid complex Elysia type issues with plugins
 */
export async function makeRequest(
  // biome-ignore lint/suspicious/noExplicitAny: Test helper needs flexibility for Elysia with various plugins
  app: any,
  method: string,
  path: string,
  body?: unknown
) {
  const url = `http://localhost${path}`

  const request = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  return app.handle(request)
}

/**
 * Cria um cliente Eden Treaty de teste (type-safe)
 *
 * @example
 * const api = createTestClient(app)
 * const { data } = await api.health.get()
 */
export function createTestClient(app: Elysia) {
  return treaty<App>(app as unknown as App)
}

/**
 * Limpa todos os dados do banco de testes
 */
export async function clearDatabase() {
  if (testDbInstance) {
    await clearTestDb(testDbInstance)
  }
}

/**
 * Destroi o banco de dados de teste e libera recursos
 * Deve ser chamado após cada teste
 */
export async function destroyTestDb() {
  if (testDbCleanup) {
    await testDbCleanup()
    testDbInstance = null
    testDbCleanup = null
  }
}
