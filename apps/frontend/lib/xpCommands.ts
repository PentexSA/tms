import type { KeyValueStorage } from '../sheet/sync/kv'

// Comandos de XP com resultado possivelmente desconhecido (doc/plano-v4.md,
// Etapa 8, contrato de rede). Conceder, ajustar, pedir e decidir exigem rede
// e não entram na fila de eventos. Antes de enviar, o comando é gravado no
// storage do usuário com a chave dele; uma resposta do servidor (sucesso ou
// recusa) o apaga. Sem resposta (rede, timeout), ele fica: o reenvio usa a
// MESMA chave e a mesma intenção, e o servidor devolve o resultado gravado
// em vez de aplicar de novo. Nunca há chave nova automática para um envio de
// resultado desconhecido. O storage é do usuário e é apagado no logout;
// credencial nunca entra aqui.

export type XpCommandKind =
  | 'grant'
  | 'adjust'
  | 'request'
  | 'approve'
  | 'reject'
  | 'cancel'

export interface XpCommand {
  readonly key: string
  readonly kind: XpCommandKind
  readonly chronicleId: string
  // Ficha do comando (no grant em grupo, a primeira, para a tela)
  readonly characterId: string
  readonly requestId?: string
  // O corpo sem a chave: a chave entra no envio, sempre a mesma
  readonly body: Readonly<Record<string, unknown>>
  // O que a pessoa vê na lista de não confirmados ("Conceder 5 XP")
  readonly label: string
  readonly at: number
}

const PREFIX = 'xp-command:'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KINDS: readonly XpCommandKind[] = [
  'grant',
  'adjust',
  'request',
  'approve',
  'reject',
  'cancel',
]
const MAX_BYTES = 16 * 1024

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** O comando lido do disco, se a forma bater; o resto é descartado. */
export function parseXpCommand(raw: unknown): XpCommand | null {
  if (!isObject(raw)) return null
  const { key, kind, chronicleId, characterId, requestId, body, label, at } =
    raw
  if (typeof key !== 'string' || !UUID.test(key)) return null
  if (!KINDS.includes(kind as XpCommandKind)) return null
  for (const id of [chronicleId, characterId])
    if (typeof id !== 'string' || !UUID.test(id)) return null
  if (
    requestId !== undefined &&
    (typeof requestId !== 'string' || !UUID.test(requestId))
  )
    return null
  if (!isObject(body)) return null
  if (typeof label !== 'string' || label.length > 200) return null
  if (typeof at !== 'number' || !Number.isFinite(at)) return null
  return {
    key,
    kind: kind as XpCommandKind,
    chronicleId: chronicleId as string,
    characterId: characterId as string,
    ...(requestId !== undefined && { requestId: requestId as string }),
    body,
    label,
    at,
  }
}

export interface XpCommandStore {
  list(): Promise<XpCommand[]>
  save(command: XpCommand): Promise<void>
  remove(key: string): Promise<void>
}

export function createXpCommandStore(storage: KeyValueStorage): XpCommandStore {
  return {
    async list() {
      const keys = await storage.keys(PREFIX)
      const out: XpCommand[] = []
      for (const k of keys) {
        const text = await storage.getItem(k)
        let parsed: XpCommand | null = null
        try {
          parsed = text ? parseXpCommand(JSON.parse(text)) : null
        } catch {
          parsed = null
        }
        if (parsed && `${PREFIX}${parsed.key}` === k) out.push(parsed)
        else await storage.removeItem(k)
      }
      return out.sort((a, b) => a.at - b.at)
    },
    async save(command) {
      const text = JSON.stringify(command)
      if (text.length > MAX_BYTES) throw new Error('comando grande demais')
      await storage.setItem(PREFIX + command.key, text)
    },
    async remove(key) {
      await storage.removeItem(PREFIX + key)
    },
  }
}

/** A chave de idempotência de cada rota (o nome do campo muda por rota). */
export function withKey(command: XpCommand): Record<string, unknown> {
  switch (command.kind) {
    case 'grant':
    case 'adjust':
      return { ...command.body, clientOperationId: command.key }
    case 'request':
      return { ...command.body, clientRequestId: command.key }
    default:
      return { ...command.body, decisionKey: command.key }
  }
}
