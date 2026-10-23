import {
  onlineManager,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createMemoryStorage } from '../../sheet/sync/kv'
import { api, unwrap } from '../api'
import { isNetworkError } from '../errors'
import { useUserStorage } from '../persist'
import {
  createXpCommandStore,
  withKey,
  type XpCommand,
  type XpCommandStore,
} from '../xpCommands'
import { chronicleKeys } from './chronicles'

// Extrato e pedidos de XP (doc/plano-v4.md, Etapa 8). Leitura pelo TanStack
// Query, sem tempo real: o foco e a reconexão rebuscam. As escritas são
// comandos com chave (lib/xpCommands.ts): exigem rede, não aplicam nada
// otimista (nem traço, nem débito) e, sem resposta, ficam para reenviar
// com a mesma chave.

export const xpKeys = {
  all: ['xp'] as const,
  ledger: (id: string) => ['xp', 'ledger', id] as const,
  requests: (id: string) => ['xp', 'requests', id] as const,
  table: (chronicleId: string) => ['xp', 'table', chronicleId] as const,
}

export interface XpBalanceData {
  readonly total: number
  readonly spent: number
  readonly available: number
}

export interface XpEntryData {
  readonly id: string
  readonly kind: 'grant' | 'adjust' | 'spend' | string
  readonly totalDelta: number
  readonly spentDelta: number
  readonly reason: string | null
  readonly reversesEntryId: string | null
  readonly at: string | Date
  readonly by: { readonly username: string } | null
  readonly reversible?: number
  readonly request?: {
    readonly id: string
    readonly label: string | null
    readonly name: string | null
    readonly from: number | null
    readonly to: number | null
  }
}

export interface XpRequestData {
  readonly id: string
  readonly characterId: string
  readonly field: string
  readonly item: string | null
  readonly name: string | null
  readonly label: string
  readonly from: number
  readonly to: number
  readonly cost: number
  readonly status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'stale'
  readonly reason: string | null
  readonly suspended?: boolean
  readonly characterName?: string
}

export const useXpLedger = (id: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: xpKeys.ledger(id),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.characters({ id }).xp.get({
          query: { limit: 20, ...(pageParam && { before: pageParam }) },
          fetch: { signal },
        })
      ) as {
        supported: boolean
        balance: XpBalanceData | null
        items: XpEntryData[]
        next: string | null
      },
    getNextPageParam: last => last.next ?? undefined,
  })

export const useXpRequests = (id: string, enabled = true) =>
  useQuery({
    queryKey: xpKeys.requests(id),
    enabled,
    queryFn: async ({ signal }) =>
      (
        unwrap(
          await api.characters({ id })['xp-requests'].get({
            query: {},
            fetch: { signal },
          })
        ) as { items: XpRequestData[] }
      ).items,
  })

export const useChronicleXpRequests = (chronicleId: string, enabled = true) =>
  useQuery({
    queryKey: xpKeys.table(chronicleId),
    enabled,
    queryFn: async ({ signal }) =>
      (
        unwrap(
          await api
            .chronicles({ id: chronicleId })
            ['xp-requests'].get({ fetch: { signal } })
        ) as { items: XpRequestData[] }
      ).items,
  })

/** Envia um comando; o erro do Eden sobe (com status, ou de rede). */
export async function sendXpCommand(command: XpCommand): Promise<unknown> {
  const body = withKey(command) as never
  const character = api.characters({ id: command.characterId })
  switch (command.kind) {
    case 'grant':
      return unwrap(
        await api.chronicles({ id: command.chronicleId }).xp.post(body)
      )
    case 'adjust':
      return unwrap(await character['xp-adjustments'].post(body))
    case 'request':
      return unwrap(await character['xp-requests'].post(body))
    default: {
      const request = character['xp-requests']({
        requestId: command.requestId ?? '',
      })
      return unwrap(await request[command.kind].post(body))
    }
  }
}

export type XpOutcome =
  | { readonly status: 'done'; readonly data: unknown }
  | { readonly status: 'refused'; readonly error: unknown }
  // Sem resposta: o comando ficou guardado para reenviar com a mesma chave
  | { readonly status: 'unknown' }
  | { readonly status: 'offline' }
  // O mesmo comando já está a caminho (toque duplo)
  | { readonly status: 'busy' }

// Sem OfflineProvider (testes, prévia): os comandos ficam só na memória
const memory = createXpCommandStore(createMemoryStorage())

/** Os comandos de XP: envio, os não confirmados e o reenvio. */
export function useXpCommands(send = sendXpCommand) {
  const queryClient = useQueryClient()
  const storage = useUserStorage()
  const store: XpCommandStore = useMemo(
    () => (storage ? createXpCommandStore(storage) : memory),
    [storage]
  )
  const [unconfirmed, setUnconfirmed] = useState<readonly XpCommand[]>([])
  const inFlight = useRef(new Set<string>())
  const refresh = useCallback(async () => {
    setUnconfirmed(await store.list().catch(() => []))
  }, [store])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = useCallback(
    async (command: XpCommand): Promise<XpOutcome> => {
      if (!onlineManager.isOnline()) return { status: 'offline' }
      // Toque duplo ou reenvio enquanto a primeira resposta não chegou
      if (inFlight.current.has(command.key)) return { status: 'busy' }
      inFlight.current.add(command.key)
      try {
        await store.save(command)
        const data = await send(command)
        await store.remove(command.key)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: xpKeys.all }),
          queryClient.invalidateQueries({ queryKey: ['characters'] }),
          queryClient.invalidateQueries({
            queryKey: chronicleKeys.table(command.chronicleId),
          }),
        ])
        return { status: 'done', data }
      } catch (error) {
        if (isNetworkError(error)) return { status: 'unknown' }
        // O servidor respondeu: a intenção está decidida, não se reenvia
        await store.remove(command.key)
        return { status: 'refused', error }
      } finally {
        inFlight.current.delete(command.key)
        await refresh()
      }
    },
    [store, send, queryClient, refresh]
  )

  return { unconfirmed, run, refresh }
}
