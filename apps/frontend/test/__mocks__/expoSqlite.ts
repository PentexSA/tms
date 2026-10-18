// O expo-sqlite sem o módulo nativo, com SQLCipher simulado: cada arquivo
// guarda a chave com que foi criado, e ler com outra chave falha como no
// SQLCipher ("file is not a database"). Só entende os comandos que o storage
// do aparelho usa (sheet/sync/encryptedStorage.ts). Funções e classes
// simples (não jest.fn), para o resetMocks não apagar o comportamento.

interface FakeFile {
  key: string | null
  table: boolean
  rows: Map<string, string>
}

export interface FakeSqlite {
  readonly files: Map<string, FakeFile>
  /** Todas as instruções, na ordem, por banco aberto. */
  readonly log: string[][]
  /** Sem SQLCipher (Expo Go): o PRAGMA key não faz nada. */
  cipher: boolean
  openDatabaseAsync(name: string): Promise<FakeDatabase>
  deleteDatabaseAsync(name: string): Promise<void>
}

const PRAGMA_KEY = /^PRAGMA key = "x'([0-9a-f]{64})'";$/

export class FakeDatabase {
  #key: string | null = null
  #closed = false
  readonly #sqlite: FakeSqlite
  readonly #name: string
  readonly #log: string[]

  constructor(sqlite: FakeSqlite, name: string, log: string[]) {
    this.#sqlite = sqlite
    this.#name = name
    this.#log = log
  }

  #file(): FakeFile {
    if (this.#closed) throw new Error('banco fechado')
    let file = this.#sqlite.files.get(this.#name)
    if (!file) {
      file = { key: null, table: false, rows: new Map() }
      this.#sqlite.files.set(this.#name, file)
    }
    return file
  }

  // A primeira leitura de verdade decide: arquivo novo fica com a chave da
  // sessão; arquivo existente só abre com a mesma chave
  #unlock(): FakeFile {
    const file = this.#file()
    const session = this.#sqlite.cipher ? this.#key : null
    if (!file.table && file.rows.size === 0 && file.key === null)
      file.key = session
    if (file.key !== session) throw new Error('file is not a database')
    return file
  }

  async execAsync(sql: string): Promise<void> {
    this.#log.push(sql)
    const key = PRAGMA_KEY.exec(sql)
    if (key) {
      this.#key = key[1] ?? null
      return
    }
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS storage')) {
      this.#unlock().table = true
      return
    }
    throw new Error(`fake: SQL não suportado: ${sql}`)
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    this.#log.push(sql)
    if (sql === 'PRAGMA cipher_version;')
      return (
        this.#sqlite.cipher ? { cipher_version: '4.6.1 community' } : null
      ) as T | null
    const file = this.#unlock()
    if (sql === 'SELECT count(*) AS n FROM sqlite_master;')
      return { n: file.table ? 1 : 0 } as T
    if (sql === 'SELECT value FROM storage WHERE key = ?;') {
      const value = file.rows.get(String(params[0]))
      return (value === undefined ? null : { value }) as T | null
    }
    throw new Error(`fake: SQL não suportado: ${sql}`)
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    this.#log.push(sql)
    const file = this.#unlock()
    if (sql === 'SELECT key FROM storage WHERE substr(key, 1, ?) = ?;') {
      const [length, prefix] = params as [number, string]
      return [...file.rows.keys()]
        .filter(k => k.slice(0, length) === prefix)
        .map(key => ({ key })) as T[]
    }
    throw new Error(`fake: SQL não suportado: ${sql}`)
  }

  async runAsync(
    sql: string,
    ...params: unknown[]
  ): Promise<{ changes: number }> {
    this.#log.push(sql)
    const file = this.#unlock()
    if (sql.startsWith('INSERT INTO storage (key, value) VALUES (?, ?)')) {
      file.rows.set(String(params[0]), String(params[1]))
      return { changes: 1 }
    }
    if (sql === 'DELETE FROM storage WHERE key = ?;')
      return { changes: file.rows.delete(String(params[0])) ? 1 : 0 }
    throw new Error(`fake: SQL não suportado: ${sql}`)
  }

  async closeAsync(): Promise<void> {
    this.#closed = true
  }
}

export function createFakeSqlite(): FakeSqlite {
  const sqlite: FakeSqlite = {
    files: new Map(),
    log: [],
    cipher: true,
    async openDatabaseAsync(name) {
      const log: string[] = []
      sqlite.log.push(log)
      return new FakeDatabase(sqlite, name, log)
    },
    async deleteDatabaseAsync(name) {
      if (!sqlite.files.delete(name)) throw new Error('database not found')
    },
  }
  return sqlite
}

// O módulo para o jest.mock('expo-sqlite') do setup
const shared = createFakeSqlite()
export const openDatabaseAsync = (name: string) =>
  shared.openDatabaseAsync(name)
export const deleteDatabaseAsync = (name: string) =>
  shared.deleteDatabaseAsync(name)
