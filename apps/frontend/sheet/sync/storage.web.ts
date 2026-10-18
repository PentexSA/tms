import type { KeyValueStorage } from './kv'

// Web: IndexedDB pela API nativa (sem lib). Fora do localStorage, que é
// síncrono e lido por qualquer script da origem sem transação. No web não há
// criptografia em repouso: a mitigação é apagar tudo no logout (§7.2).

const DB = 'tms-offline'
const STORE = 'kv'

// Só o pedaço do IndexedDB que este arquivo usa: o app não carrega os tipos
// do DOM (é React Native), e trazer a lib inteira valeria para todo o código.
interface IdbRequest<T> {
  readonly result: T
  readonly error: unknown
  onsuccess: (() => void) | null
  onerror: (() => void) | null
}
interface IdbOpenRequest extends IdbRequest<IdbDatabase> {
  onupgradeneeded: (() => void) | null
}
interface IdbStore {
  get(key: string): IdbRequest<unknown>
  put(value: string, key: string): IdbRequest<unknown>
  delete(key: string): IdbRequest<unknown>
  getAllKeys(range: unknown): IdbRequest<unknown[]>
}
interface IdbTransaction {
  readonly error: unknown
  objectStore(name: string): IdbStore
  oncomplete: (() => void) | null
  onerror: (() => void) | null
  onabort: (() => void) | null
}
interface IdbDatabase {
  transaction(store: string, mode: 'readonly' | 'readwrite'): IdbTransaction
  createObjectStore(name: string): unknown
}
export interface IdbFactoryLike {
  open(name: string, version: number): IdbOpenRequest
}
export interface IdbKeyRangeLike {
  bound(lower: string, upper: string): unknown
}

const platform = globalThis as {
  indexedDB?: IdbFactoryLike
  IDBKeyRange?: IdbKeyRangeLike
}

export interface IndexedDbDeps {
  readonly factory?: IdbFactoryLike
  readonly keyRange?: IdbKeyRangeLike
}

/** Resolve o IndexedDB só no primeiro uso (o export estático roda sem ele). */
export function createIndexedDbStorage(
  deps: IndexedDbDeps = {}
): KeyValueStorage {
  let opened: Promise<IdbDatabase> | null = null
  const open = () => {
    opened ??= new Promise<IdbDatabase>((resolve, reject) => {
      const factory = deps.factory ?? platform.indexedDB
      if (!factory) {
        reject(new Error('IndexedDB indisponível'))
        return
      }
      const req = factory.open(DB, 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }).catch(error => {
      // Tenta de novo na próxima chamada
      opened = null
      throw error
    })
    return opened
  }
  const run = async <T>(
    mode: 'readonly' | 'readwrite',
    action: (store: IdbStore) => IdbRequest<T>
  ): Promise<T> => {
    const db = await open()
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = action(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }
  return {
    async getItem(key) {
      const value = await run('readonly', s => s.get(key))
      return typeof value === 'string' ? value : null
    },
    async setItem(key, value) {
      await run('readwrite', s => s.put(value, key))
    },
    async removeItem(key) {
      await run('readwrite', s => s.delete(key))
    },
    async keys(prefix) {
      // Faixa de chaves: tudo que começa com o prefixo
      const keyRange = deps.keyRange ?? platform.IDBKeyRange
      if (!keyRange) throw new Error('IndexedDB indisponível')
      const range = keyRange.bound(prefix, `${prefix}\uffff`)
      const keys = await run('readonly', s => s.getAllKeys(range))
      return keys.filter((k): k is string => typeof k === 'string')
    },
  }
}

export const deviceStorage: KeyValueStorage = createIndexedDbStorage()
