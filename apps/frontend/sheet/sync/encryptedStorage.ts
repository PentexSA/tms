import { createMemoryStorage, type KeyValueStorage } from './kv'

// O storage do aparelho no iOS e no Android (doc/arquitetura §7.2): um banco
// SQLCipher próprio, com chave aleatória de 32 bytes gerada no primeiro uso e
// guardada no Keychain/Keystore (expo-secure-store), nunca em outro lugar.
// As dependências vêm de fora (storage.native.ts) para os testes trocarem.
//
// Fail secure:
// - sem chave, um banco que exista é ilegível (reinstalação, backup) ou é o
//   da Etapa 20, sem cifra: é apagado e recomeça vazio. O servidor é a fonte
//   da verdade; o que se perde é cache;
// - a chave não abre o banco: apaga e recomeça;
// - o SecureStore falhou: não abre o banco sem chave; fica em memória (vale
//   só enquanto o app está aberto) e o banco fica intacto para a próxima;
// - sem SQLCipher no binário (Expo Go), o PRAGMA key não cifra nada: só em
//   desenvolvimento (`allowPlaintext`) o banco abre assim.
// O log leva só o tipo do problema, nunca a chave nem a mensagem do erro
// (a do SQLite pode repetir a instrução).

export const DB_NAME = 'tms-offline.db'
export const KEY_NAME = 'tms.offlineDbKey'
const KEY_BYTES = 32
const HEX_KEY = /^[0-9a-f]{64}$/

export type StorageProblem =
  | 'secure-store'
  | 'wrong-key'
  | 'no-sqlcipher'
  | 'sqlite'

/** O subconjunto do SQLiteDatabase do expo-sqlite que o storage usa. */
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>
  getFirstAsync<T>(
    sql: string,
    ...params: (string | number)[]
  ): Promise<T | null>
  getAllAsync<T>(sql: string, ...params: (string | number)[]): Promise<T[]>
  runAsync(sql: string, ...params: (string | number)[]): Promise<unknown>
  closeAsync(): Promise<void>
}

export interface EncryptedStorageDeps {
  readonly openDatabase: (name: string) => Promise<SqlDatabase>
  readonly deleteDatabase: (name: string) => Promise<void>
  readonly secrets: {
    get(key: string): Promise<string | null | undefined>
    set(key: string, value: string): Promise<void>
  }
  readonly randomBytes: (count: number) => Uint8Array
  /** Só em desenvolvimento: o Expo Go não tem SQLCipher. */
  readonly allowPlaintext?: boolean
  readonly report?: (problem: StorageProblem) => void
}

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

function sqlStorage(db: SqlDatabase): KeyValueStorage {
  return {
    async getItem(key) {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM storage WHERE key = ?;',
        key
      )
      return row?.value ?? null
    },
    async setItem(key, value) {
      await db.runAsync(
        'INSERT INTO storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
        key,
        value
      )
    },
    async removeItem(key) {
      await db.runAsync('DELETE FROM storage WHERE key = ?;', key)
    },
    async keys(prefix) {
      // substr, não LIKE: "%" e "_" no prefixo não viram curinga
      const rows = await db.getAllAsync<{ key: string }>(
        'SELECT key FROM storage WHERE substr(key, 1, ?) = ?;',
        prefix.length,
        prefix
      )
      return rows.map(r => r.key)
    },
  }
}

async function deleteQuietly(deps: EncryptedStorageDeps) {
  try {
    await deps.deleteDatabase(DB_NAME)
  } catch {
    // Não existia
  }
}

async function openWithKey(
  deps: EncryptedStorageDeps,
  key: string
): Promise<KeyValueStorage> {
  if (!HEX_KEY.test(key)) throw new Error('chave inválida')
  const db = await deps.openDatabase(DB_NAME)
  try {
    // Antes de qualquer outra instrução; a chave em hex é "raw key" (sem
    // derivação), e o formato foi conferido acima: nada de injeção aqui
    await db.execAsync(`PRAGMA key = "x'${key}'";`)
    const cipher = await db.getFirstAsync<{ cipher_version?: string }>(
      'PRAGMA cipher_version;'
    )
    if (!cipher?.cipher_version && !deps.allowPlaintext)
      throw new NoCipherError()
    // Com a chave errada, a primeira leitura falha
    await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master;')
    await db.execAsync(
      'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);'
    )
    return sqlStorage(db)
  } catch (error) {
    await db.closeAsync().catch(() => undefined)
    throw error
  }
}

class NoCipherError extends Error {}

async function openStorage(
  deps: EncryptedStorageDeps
): Promise<KeyValueStorage> {
  const memory = (problem: StorageProblem) => {
    deps.report?.(problem)
    return createMemoryStorage()
  }

  let key: string | null
  try {
    const stored = await deps.secrets.get(KEY_NAME)
    key = typeof stored === 'string' && HEX_KEY.test(stored) ? stored : null
  } catch {
    return memory('secure-store')
  }
  if (key === null) {
    await deleteQuietly(deps)
    key = toHex(deps.randomBytes(KEY_BYTES))
    try {
      await deps.secrets.set(KEY_NAME, key)
    } catch {
      return memory('secure-store')
    }
  }

  try {
    return await openWithKey(deps, key)
  } catch (error) {
    if (error instanceof NoCipherError) return memory('no-sqlcipher')
    deps.report?.('wrong-key')
  }
  // A chave não abriu o banco (outra chave, arquivo corrompido): recomeça
  await deleteQuietly(deps)
  try {
    return await openWithKey(deps, key)
  } catch {
    return memory('sqlite')
  }
}

/**
 * O KeyValueStorage cifrado. Abre na primeira operação (não no import) e uma
 * vez só, mesmo com chamadas em paralelo.
 */
export function createEncryptedStorage(
  deps: EncryptedStorageDeps
): KeyValueStorage {
  let ready: Promise<KeyValueStorage> | undefined
  const open = () => {
    ready ??= openStorage(deps)
    return ready
  }
  return {
    getItem: async key => (await open()).getItem(key),
    setItem: async (key, value) => (await open()).setItem(key, value),
    removeItem: async key => (await open()).removeItem(key),
    keys: async prefix => (await open()).keys(prefix),
  }
}
