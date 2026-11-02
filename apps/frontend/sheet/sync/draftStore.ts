import { MAX_EVENTS_PER_BATCH, parsePath } from '@tms/sheet-core'
import { createMemoryStorage, type KeyValueStorage } from './kv'
import { MAX_BATCH_BYTES } from './outbox'

// O rascunho de Criação/Editar no storage do aparelho (T-03), para sobreviver
// a fechar o app, a uma queda ou ao F5. Mora no mesmo storage do outbox e do
// cache, pelo UserStorage: no app, o banco SQLCipher com a chave no
// Keychain/Keystore; no web, o IndexedDB (sem cifra em repouso, por projeto,
// arquitetura §7.2). A chave é `draft:<characterId>` dentro do escopo do
// usuário; o logout apaga o escopo inteiro.
//
// O registro guarda só a ficha: caminhos e valores, numa lista fechada de
// campos. Nada de token, credencial ou texto da tela. O que vem do disco é
// input hostil: forma errada, caminho inválido, grande demais, vencido ou do
// futuro é descartado e apagado. Nada aqui vai para log.

const KEY = 'draft:'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VERSION = /^\d{1,6}\.\d{1,6}\.\d{1,6}$/

/** O mesmo prazo do cache e do último usuário: 7 dias. */
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * O registro guarda um lote (até 50 eventos e 64 KiB, os limites da API e do
 * core) mais os metadados: a folga cobre a versão, o modo e as datas. O
 * store não deixa o rascunho passar do lote (draftLimit).
 */
export const MAX_DRAFT_BYTES = MAX_BATCH_BYTES + 1024

export interface DraftEditRecord {
  readonly path: string
  readonly from: unknown
  readonly to: unknown
}

export interface DraftRecord {
  readonly v: 1
  readonly characterId: string
  // A versão do template da ficha: outra versão, outro modelo
  readonly templateVersion: string
  // A sheetVersion quando o rascunho foi gravado
  readonly baseVersion: number
  readonly mode: 'create' | 'evolve'
  // ms; no futuro ou com mais de 7 dias, o registro é descartado
  readonly savedAt: number
  readonly edits: readonly DraftEditRecord[]
}

export interface DraftCount {
  /** Quantas fichas têm rascunho guardado (o aviso de "Sair"). */
  getSnapshot(): number
  subscribe(listener: () => void): () => void
}

export interface DraftStore {
  read(characterId: string): Promise<DraftRecord | null>
  /**
   * Grava; sem alterações, apaga. Registro inválido ou grande demais não é
   * gravado e o anterior sai (nunca fica um retrato velho): devolve false,
   * e quem chamou avisa que o rascunho não será recuperável.
   */
  write(record: DraftRecord): Promise<boolean>
  /**
   * O "Salvar" recusado com a ficha fechada (ou sem permissão de edição)
   * volta como rascunho guardado: grava e avisa quem estiver com a ficha
   * aberta, para oferecer "Recuperar".
   */
  park(record: DraftRecord): Promise<boolean>
  /** A ficha aberta escuta o rascunho que voltou do servidor. */
  onParked(listener: (characterId: string) => void): () => void
  remove(characterId: string): Promise<void>
  /** As fichas com rascunho válido. */
  characters(): Promise<string[]>
  /** Logout: apaga todos os rascunhos deste storage. */
  clear(): Promise<void>
  /** Abriu o app: apaga o que venceu ou está quebrado. */
  sweep(now: number): Promise<void>
  readonly count: DraftCount
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const bytes = (text: string) => new TextEncoder().encode(text).length

/** O registro, se a forma e os limites baterem; senão null. */
export function parseDraftRecord(
  raw: unknown,
  now: number
): DraftRecord | null {
  if (!isObject(raw)) return null
  const { v, characterId, templateVersion, baseVersion, mode, savedAt, edits } =
    raw
  if (v !== 1) return null
  if (typeof characterId !== 'string' || !UUID.test(characterId)) return null
  if (typeof templateVersion !== 'string' || !VERSION.test(templateVersion))
    return null
  if (
    typeof baseVersion !== 'number' ||
    !Number.isInteger(baseVersion) ||
    baseVersion < 0
  )
    return null
  if (mode !== 'create' && mode !== 'evolve') return null
  if (
    typeof savedAt !== 'number' ||
    !Number.isFinite(savedAt) ||
    savedAt > now ||
    now - savedAt > DRAFT_MAX_AGE_MS
  )
    return null
  if (
    !Array.isArray(edits) ||
    edits.length === 0 ||
    edits.length > MAX_EVENTS_PER_BATCH
  )
    return null
  const seen = new Set<string>()
  const clean: DraftEditRecord[] = []
  for (const e of edits) {
    if (!isObject(e) || typeof e.path !== 'string' || !Object.hasOwn(e, 'to'))
      return null
    if (!parsePath(e.path) || seen.has(e.path)) return null
    seen.add(e.path)
    clean.push({ path: e.path, from: e.from ?? null, to: e.to })
  }
  // Lista fechada: o que sai daqui tem só estes campos
  const record: DraftRecord = {
    v: 1,
    characterId,
    templateVersion,
    baseVersion,
    mode,
    savedAt,
    edits: clean,
  }
  return bytes(JSON.stringify(record)) > MAX_DRAFT_BYTES ? null : record
}

export function createPersistedDraftStore(
  storage: KeyValueStorage,
  clock: () => number = Date.now
): DraftStore {
  // Uma operação por vez, como o outbox
  let chain: Promise<unknown> = Promise.resolve()
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work)
    chain = next.catch(() => undefined)
    return next
  }

  // As fichas com rascunho, para o aviso de "Sair" sem ler o disco a cada
  // render. Atualizado a cada operação; `characters()` refaz a lista.
  const known = new Set<string>()
  const listeners = new Set<() => void>()
  let snapshot = 0
  const changed = () => {
    if (known.size === snapshot) return
    snapshot = known.size
    for (const l of listeners) l()
  }

  const drop = async (characterId: string) => {
    await storage.removeItem(KEY + characterId)
    known.delete(characterId)
  }

  const read = async (
    characterId: string,
    now = clock()
  ): Promise<DraftRecord | null> => {
    const text = await storage.getItem(KEY + characterId)
    if (text === null) {
      known.delete(characterId)
      return null
    }
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      raw = null
    }
    const record = parseDraftRecord(raw, now)
    // O registro de outra ficha nesta chave também é descartado
    if (!record || record.characterId !== characterId) {
      await drop(characterId)
      return null
    }
    known.add(characterId)
    return record
  }

  const list = async (now = clock()): Promise<string[]> => {
    const ids: string[] = []
    for (const key of await storage.keys(KEY)) {
      const id = key.slice(KEY.length)
      if (UUID.test(id) && (await read(id, now))) ids.push(id)
      else if (!UUID.test(id)) await storage.removeItem(key)
    }
    known.clear()
    for (const id of ids) known.add(id)
    return ids
  }

  const parkedListeners = new Set<(characterId: string) => void>()

  const write = async (record: DraftRecord): Promise<boolean> => {
    if (!UUID.test(record.characterId)) return false
    if (!record.edits.length) {
      await drop(record.characterId)
      changed()
      return true
    }
    const clean = parseDraftRecord(record, clock())
    // Fora dos limites: nada é gravado, e o registro anterior sai, porque
    // recuperar um retrato velho desfaria alterações em silêncio
    if (!clean) {
      await drop(record.characterId)
      changed()
      return false
    }
    await storage.setItem(KEY + clean.characterId, JSON.stringify(clean))
    known.add(clean.characterId)
    changed()
    return true
  }

  return {
    read: characterId =>
      serial(async () => {
        if (!UUID.test(characterId)) return null
        const record = await read(characterId)
        changed()
        return record
      }),
    write: record => serial(() => write(record)),
    park: record =>
      serial(async () => {
        const ok = await write(record)
        if (ok) for (const l of parkedListeners) l(record.characterId)
        return ok
      }),
    onParked(listener) {
      parkedListeners.add(listener)
      return () => parkedListeners.delete(listener)
    },
    remove: characterId =>
      serial(async () => {
        if (!UUID.test(characterId)) return
        await drop(characterId)
        changed()
      }),
    characters: () =>
      serial(async () => {
        const ids = await list()
        changed()
        return ids
      }),
    clear: () =>
      serial(async () => {
        for (const key of await storage.keys(KEY)) await storage.removeItem(key)
        known.clear()
        changed()
      }),
    sweep: now =>
      serial(async () => {
        await list(now)
        changed()
      }),
    count: {
      getSnapshot: () => snapshot,
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
  }
}

/** Sem storage do aparelho (sem OfflineProvider, testes): só em memória. */
export const createMemoryDraftStore = (clock: () => number = Date.now) =>
  createPersistedDraftStore(createMemoryStorage(), clock)

/**
 * O rascunho que volta de um "Salvar" recusado: as alterações do lote, com o
 * rascunho que já estava guardado por cima (o mais novo vence no `to`; o
 * `from` é o do lote, que é o que a ficha salva tinha). Nada se perde: o que
 * mudou desde então aparece como conflito ao recuperar.
 */
export function returnedDraft(
  existing: DraftRecord | null,
  events: readonly DraftEditRecord[],
  meta: {
    readonly characterId: string
    readonly templateVersion: string
    readonly mode: 'create' | 'evolve'
    readonly baseVersion: number
  },
  now: number
): DraftRecord {
  const edits = new Map<string, DraftEditRecord>()
  for (const e of events)
    edits.set(e.path, { path: e.path, from: e.from, to: e.to })
  for (const e of existing?.edits ?? []) {
    const back = edits.get(e.path)
    edits.set(e.path, back ? { ...back, to: e.to } : e)
  }
  return {
    v: 1,
    characterId: meta.characterId,
    templateVersion: meta.templateVersion,
    baseVersion: meta.baseVersion,
    mode: meta.mode,
    savedAt: now,
    edits: [...edits.values()].filter(
      e => JSON.stringify(e.from) !== JSON.stringify(e.to)
    ),
  }
}
