import { db } from '@tms/db'

// Mock import.meta for Bun compatibility in Jest
// @ts-ignore
global.importMeta = { main: false }

/**
 * Setup global para todos os testes da API
 *
 * Executado uma vez antes de todos os testes
 */
beforeAll(async () => {
  console.log('🧪 Starting API test suite...')
  console.log('🗄️  Using real PostgreSQL database')
})

/**
 * Cleanup global após todos os testes
 */
afterAll(async () => {
  console.log('✅ API test suite finished')
  // Fecha a conexão com o banco de dados
  await db.destroy()
})

/**
 * Setup antes de cada teste
 *
 * Limpa o banco de dados para garantir que cada teste
 * comece com um estado limpo
 */
beforeEach(async () => {
  // Limpa a tabela todos antes de cada teste
  await db.deleteFrom('todos').execute()
})
