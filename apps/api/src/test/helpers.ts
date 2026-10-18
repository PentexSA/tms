import { type Treaty, treaty } from '@elysiajs/eden'
import { createPGliteTestDb } from '@tms/db/testing'
import { type App, createApp } from '../index'

// Banco do teste atual, destruído por destroyTestDb()
let testDbCleanup: (() => Promise<void>) | null = null

/**
 * Cria uma instância de teste da aplicação Elysia com PGLite database
 *
 * IMPORTANTE: Não chama .listen() para não abrir porta real
 * Usa um banco de dados em memória (PGLite) isolado para testes
 *
 * @example
 * const app = await createTestApp()
 * const response = await app.handle(new Request('http://localhost/health'))
 */
export async function createTestApp() {
  // Banco novo a cada teste, com todas as migrations de @tms/db
  const { db, destroy } = await createPGliteTestDb()
  testDbCleanup = destroy

  return createApp(db)
}

/**
 * Faz uma requisição HTTP de teste para a aplicação
 *
 * @example
 * const response = await makeRequest(app, 'GET', '/health')
 * expect(response.status).toBe(200)
 */
export async function makeRequest(
  app: App,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const request = new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
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
export function createTestClient(app: App): Treaty.Create<App> {
  return treaty<App>(app)
}

/**
 * Destroi o banco de dados de teste e libera recursos
 * Deve ser chamado após cada teste
 */
export async function destroyTestDb() {
  if (testDbCleanup) {
    await testDbCleanup()
    testDbCleanup = null
  }
}
