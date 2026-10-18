import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { createFakeSqlite } from '../../../test/__mocks__/expoSqlite'
import { createEncryptedStorage } from '../encryptedStorage'
import {
  createMemoryStorage,
  type KeyValueStorage,
  scopeStorage,
  userPrefix,
} from '../kv'
import { createIndexedDbStorage } from '../storage.web'

// O jest-expo resolve `../storage` para o .native: o fallback vai explícito
const { deviceStorage: fallback } = require('../storage.ts') as {
  deviceStorage: KeyValueStorage
}

// Etapa 20: o storage do aparelho (doc/arquitetura §7.1 e §7.2).

const A = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-0000000000b2'

describe('o mesmo contrato nas três implementações', () => {
  it.each([
    ['memória', () => createMemoryStorage()],
    ['fallback (sem plataforma)', () => fallback],
    [
      'nativo (SQLCipher)',
      () => {
        const sqlite = createFakeSqlite()
        const secrets = new Map<string, string>()
        return createEncryptedStorage({
          openDatabase: name => sqlite.openDatabaseAsync(name),
          deleteDatabase: name => sqlite.deleteDatabaseAsync(name),
          secrets: {
            get: async k => secrets.get(k) ?? null,
            set: async (k, v) => {
              secrets.set(k, v)
            },
          },
          randomBytes: n => new Uint8Array(n).fill(7),
        })
      },
    ],
    [
      'web (IndexedDB)',
      () =>
        createIndexedDbStorage({
          factory: new IDBFactory(),
          keyRange: IDBKeyRange,
        }),
    ],
  ])('%s: get, set, remove e keys por prefixo', async (_, make) => {
    const storage = make()
    expect(await storage.getItem('x:1')).toBeNull()
    await storage.setItem('x:1', 'um')
    await storage.setItem('x:2', 'dois')
    await storage.setItem('y:1', 'outro')
    expect(await storage.getItem('x:1')).toBe('um')
    expect((await storage.keys('x:')).sort()).toEqual(['x:1', 'x:2'])
    await storage.setItem('x:1', 'de novo')
    expect(await storage.getItem('x:1')).toBe('de novo')
    await storage.removeItem('x:1')
    await storage.removeItem('x:2')
    await storage.removeItem('y:1')
    expect(await storage.getItem('x:1')).toBeNull()
    expect(await storage.keys('x:')).toEqual([])
  })
})

describe('IndexedDB', () => {
  it('sem IndexedDB (export estático do web): falha só ao usar', async () => {
    const storage = createIndexedDbStorage({ factory: undefined })
    const saved = (globalThis as { indexedDB?: unknown }).indexedDB
    expect(saved).toBeUndefined()
    await expect(storage.getItem('x')).rejects.toThrow('IndexedDB indisponível')
  })

  it('o mesmo banco é lido por outra instância (recarregar a página)', async () => {
    const factory = new IDBFactory()
    const first = createIndexedDbStorage({ factory, keyRange: IDBKeyRange })
    await first.setItem('k', 'v')
    const second = createIndexedDbStorage({ factory, keyRange: IDBKeyRange })
    expect(await second.getItem('k')).toBe('v')
  })

  it('valor que não é texto volta como ausente', async () => {
    const factory = new IDBFactory()
    const storage = createIndexedDbStorage({ factory, keyRange: IDBKeyRange })
    await storage.setItem('k', 'v')
    // Adultera direto no banco: um objeto no lugar do texto
    await new Promise<void>((resolve, reject) => {
      const req = factory.open('tms-offline', 1)
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite')
        tx.objectStore('kv').put({ evil: true }, 'k')
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
    })
    expect(await storage.getItem('k')).toBeNull()
  })
})

describe('storage por usuário', () => {
  it('toda chave leva o id do usuário; B nunca lê o que é de A', async () => {
    const storage = createMemoryStorage()
    const a = scopeStorage(storage, A)
    const b = scopeStorage(storage, B)
    await a.setItem('query-cache', 'de A')
    expect([...storage.data.keys()]).toEqual([`${userPrefix(A)}query-cache`])
    expect(await b.getItem('query-cache')).toBeNull()
    expect(await b.keys('')).toEqual([])
    expect(await a.keys('query')).toEqual(['query-cache'])
  })

  it('clear apaga só o usuário; close ignora gravação atrasada', async () => {
    const storage = createMemoryStorage()
    const a = scopeStorage(storage, A)
    const b = scopeStorage(storage, B)
    await a.setItem('x', '1')
    await b.setItem('x', '2')
    await a.clear()
    expect(await a.getItem('x')).toBeNull()
    expect(await b.getItem('x')).toBe('2')

    a.close()
    await a.setItem('x', 'depois do logout')
    expect(storage.data.has(`${userPrefix(A)}x`)).toBe(false)
    expect(await a.getItem('x')).toBeNull()
    expect(await a.keys('')).toEqual([])
    expect(a.userId).toBe(A)
  })

  it('id com caractere estranho não vira chave', () => {
    expect(() => scopeStorage(createMemoryStorage(), 'a:b')).toThrow()
    expect(() => scopeStorage(createMemoryStorage(), '')).toThrow()
    expect(() => scopeStorage(createMemoryStorage(), '../x')).toThrow()
  })
})
