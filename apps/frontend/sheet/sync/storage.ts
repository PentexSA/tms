import { createMemoryStorage, type KeyValueStorage } from './kv'

// Sem plataforma (Node, testes): em memória. O Metro resolve
// storage.native.ts no iOS e no Android, e storage.web.ts no web.
export const deviceStorage: KeyValueStorage = createMemoryStorage()
