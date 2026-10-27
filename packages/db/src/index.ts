export { db } from './client'
export { migrationProvider, migrations } from './migrations'
export {
  canonicalJson,
  PRODUCT_TEMPLATES,
  type StoredTemplate,
  storeTemplate,
  templateHash,
} from './templates'
export type { DB } from './types'
// O PGLite dos testes fica em `@tms/db/testing`, fora do bundle da API
