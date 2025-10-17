import { treaty } from '@elysiajs/eden'
import { Elysia } from 'elysia'
import { type App, createApp } from '../index'

/**
 * Cria uma instância de teste da aplicação Elysia
 *
 * IMPORTANTE: Não chama .listen() para não abrir porta real
 *
 * @example
 * const app = createTestApp()
 * const response = await app.handle(new Request('http://localhost/health'))
 */
export function createTestApp() {
  return createApp()
}

/**
 * Faz uma requisição HTTP de teste para a aplicação
 *
 * @example
 * const response = await makeRequest(app, 'GET', '/health')
 * expect(response.status).toBe(200)
 */
export async function makeRequest(
  app: Elysia,
  method: string,
  path: string,
  body?: any
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
  return treaty<App>(app as any)
}

/**
 * Limpa todas as tabelas do banco de dados
 *
 * Usa o DB real para testes
 */
export async function clearDatabase() {
  const { db } = await import('@tms/db')
  await db.deleteFrom('todos').execute()
}

/**
 * Popula o banco com dados de teste
 *
 * TODO: Implementar quando necessário
 */
export async function seedDatabase(data: any) {
  // Inserir dados de teste no DB
  // Por enquanto não é necessário, pois os testes criam seus próprios dados
}
