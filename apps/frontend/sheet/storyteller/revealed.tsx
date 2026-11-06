import { useQueryClient } from '@tanstack/react-query'
import {
  type FieldId,
  type RoleName,
  revealableSections,
  type SheetModel,
} from '@tms/sheet-core'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react'

import { statusOf } from '../../lib/errors'
import { isObject } from '../../lib/guards'
import { useOnline } from '../../lib/network'
import { revealKeys, useRevealedNotes } from '../../lib/queries/reveal'

// U-11 (P16-D): o estado da revelação das Notas do Narrador na ficha aberta.
// O narrador lê o estado (rótulo, botão, aviso do editor); o dono lê o texto,
// que vem da rota própria e fica só na memória (nunca no disco: a chave tem
// três elementos, fora do `persistable`). O que vem da ficha ou do disco é
// input hostil: lista de textos, até 8, só seções que o modelo deixa revelar.

export interface Reveal {
  readonly sections: readonly string[]
  readonly revision: number
}

/** O `reveal` da ficha, conferido (fail secure: forma errada é nada). */
export function revealOf(model: SheetModel, value: unknown): Reveal {
  if (!isObject(value)) return { sections: [], revision: 0 }
  const allowed = revealableSections(model)
  const raw = Array.isArray(value.sections) ? value.sections.slice(0, 8) : []
  const sections = raw.filter(
    (s): s is string => typeof s === 'string' && allowed.includes(s)
  )
  const revision =
    Number.isInteger(value.revision) && (value.revision as number) >= 0
      ? (value.revision as number)
      : 0
  return { sections: [...new Set(sections)], revision }
}

export type RevealedStatus = 'idle' | 'loading' | 'ready' | 'offline' | 'error'

export interface RevealedValue {
  readonly characterId: string
  readonly ownerName: string
  // O narrador da crônica numa ficha de jogador de outra pessoa
  readonly narrator: boolean
  readonly sections: ReadonlySet<string>
  readonly revision: number
  // O texto revelado, só para o dono (e só o carregado e atual)
  readonly values: ReadonlyMap<FieldId, string>
  readonly status: RevealedStatus
}

const RevealedContext = createContext<RevealedValue | null>(null)

/** Null fora de uma ficha viva (a projeção do viewer, os testes): como hoje. */
export const useRevealed = (): RevealedValue | null =>
  useContext(RevealedContext)

const EMPTY = new Map<FieldId, string>()

export function RevealedProvider({
  characterId,
  model,
  roles,
  kind,
  ownerName,
  reveal,
  children,
}: {
  readonly characterId: string
  readonly model: SheetModel
  readonly roles: readonly RoleName[]
  readonly kind: 'pc' | 'npc'
  readonly ownerName: string
  readonly reveal: unknown
  readonly children: ReactNode
}) {
  const queryClient = useQueryClient()
  const online = useOnline()
  const state = revealOf(model, reveal)
  const pc = kind === 'pc'
  const narrator =
    pc && roles.includes('storyteller') && !roles.includes('owner')
  const owner = pc && roles.includes('owner') && !roles.includes('storyteller')
  const reads = owner && state.sections.length > 0
  const query = useRevealedNotes(characterId, reads)
  // A nota voltou a ser privada (a ficha rebuscada diz), ou o dono perdeu o
  // acesso (404): a consulta sai da memória, e o bloco some
  const lost = statusOf(query.error) === 404
  useEffect(() => {
    if (reads && !lost) return
    const queryKey = revealKeys.revealed(characterId)
    void queryClient.cancelQueries({ queryKey })
    // Volta ao estado inicial (sem o texto) antes de sair do cache: o
    // observador desligado continua montado e não deve guardar o texto
    void queryClient.resetQueries({ queryKey })
    queryClient.removeQueries({ queryKey })
  }, [reads, lost, characterId, queryClient])
  // Resposta mais velha que a ficha (pedido em voo antes de esconder ou de
  // revelar de novo): descartada, e a consulta rebusca
  const data = query.data
  // Só enquanto o dono lê: depois de esconder, nada rebusca o texto
  const stale = reads && data !== undefined && data.revision < state.revision
  const refetch = query.refetch
  useEffect(() => {
    if (stale) void refetch()
  }, [stale, refetch])
  // A rota mais nova que a ficha: a ficha rebusca o estado
  const ahead = reads && data !== undefined && data.revision > state.revision
  useEffect(() => {
    if (ahead)
      void queryClient.invalidateQueries({
        queryKey: ['characters', characterId],
        exact: true,
      })
  }, [ahead, characterId, queryClient])

  const fresh = reads && data && !stale && !lost ? data : undefined
  const ids =
    owner && lost
      ? []
      : fresh && ahead
        ? fresh.sections
            .map(s => s.id)
            .filter(id => state.sections.includes(id))
        : state.sections
  // Mesma identidade enquanto a lista não muda: a ficha memoiza por ela
  const idsKey = ids.join('\u0000')
  // biome-ignore lint/correctness/useExhaustiveDependencies: a chave é a lista
  const sections = useMemo<ReadonlySet<string>>(() => new Set(ids), [idsKey])
  const values = useMemo<ReadonlyMap<FieldId, string>>(() => {
    if (!fresh) return EMPTY
    const map = new Map<FieldId, string>()
    for (const section of fresh.sections) {
      if (!sections.has(section.id)) continue
      const fields = model.sections.get(section.id)?.fieldIds ?? []
      for (const id of fields) {
        const text = section.values[id]
        if (typeof text === 'string') map.set(id, text)
      }
    }
    return map
  }, [fresh, sections, model])
  const status: RevealedStatus = !reads
    ? 'idle'
    : fresh
      ? 'ready'
      : !online
        ? 'offline'
        : query.isError
          ? 'error'
          : 'loading'
  const revision = state.revision
  const value = useMemo<RevealedValue>(
    () => ({
      characterId,
      ownerName,
      narrator,
      sections,
      revision,
      values,
      status,
    }),
    [characterId, ownerName, narrator, sections, revision, values, status]
  )
  return (
    <RevealedContext.Provider value={value}>
      {children}
    </RevealedContext.Provider>
  )
}
