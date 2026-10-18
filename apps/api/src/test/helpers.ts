import { type Treaty, treaty } from '@elysiajs/eden'
import type { DB } from '@tms/db'
import { createPGliteTestDb } from '@tms/db/testing'
import type { Kysely } from 'kysely'
import { type App, createApp } from '../index'
import type { AppOptions } from '../options'

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
export async function createTestApp(overrides: Partial<AppOptions> = {}) {
  return (await createTestContext(overrides)).app
}

/** Relógio controlado pelo teste (expiração de token, janelas de rate limit). */
export function fakeClock(start = new Date('2026-10-18T12:00:00Z')) {
  let t = start.getTime()
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms
    },
  }
}

export interface TestContext {
  readonly app: App
  readonly db: Kysely<DB>
  readonly clock: ReturnType<typeof fakeClock>
}

/** App + banco de teste + relógio falso. Destrua com destroyTestDb(). */
export async function createTestContext(
  overrides: Partial<AppOptions> = {}
): Promise<TestContext> {
  // Banco novo a cada teste, com todas as migrations de @tms/db
  const { db, destroy } = await createPGliteTestDb()
  testDbCleanup = destroy
  const clock = fakeClock()
  const app = createApp(db, { now: clock.now, ...overrides })
  return { app, db, clock }
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
