import { db } from '../client'

/**
 * Limpa todas as tabelas do banco de dados
 */
export async function clearAllTables() {
  await db.deleteFrom('todos').execute()
}

/**
 * Verifica se a conexão com o banco está funcionando
 */
export async function checkConnection() {
  try {
    await db.selectFrom('todos').select('id').limit(1).execute()
    return true
  } catch (error) {
    return false
  }
}
