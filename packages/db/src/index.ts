export { db } from './client'
export { migrationProvider, migrations } from './migrations'
export type { DB } from './types'
// O PGLite dos testes fica em `@tms/db/testing`, fora do bundle da API
