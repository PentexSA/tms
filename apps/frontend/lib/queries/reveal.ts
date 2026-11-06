import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap } from '../api'
import { statusOf } from '../errors'

// U-11 (P16-D): o narrador revela ao dono as Notas do Narrador de uma ficha,
// só em leitura, e esconde de novo. O texto revelado vem de uma rota própria,
// numa chave de TRÊS elementos: o cache persistido (`persistable`, em
// lib/persist.tsx) só grava chaves de dois, então o texto nunca vai ao disco
// do aparelho. A ficha (que vai ao disco) traz só os ids e a revisão.

export const revealKeys = {
  revealed: (id: string) => ['characters', id, 'revealed'] as const,
}

/** Com a ficha aberta e em primeiro plano, como o PENDING_REFETCH_MS. */
export const REVEALED_REFETCH_MS = 30_000

export interface RevealedNotes {
  readonly revision: number
  readonly sections: readonly {
    readonly id: string
    readonly values: Readonly<Record<string, string>>
  }[]
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * A resposta da rota, conferida: o que vem da rede é input hostil. Forma
 * errada vira "nada revelado" (fail secure), nunca texto solto na tela.
 */
export function parseRevealed(data: unknown): RevealedNotes {
  if (!isObject(data) || !Number.isInteger(data.revision))
    return { revision: -1, sections: [] }
  const sections = Array.isArray(data.sections) ? data.sections : []
  return {
    revision: data.revision as number,
    sections: sections.slice(0, 8).flatMap(s => {
      if (!isObject(s) || typeof s.id !== 'string' || !isObject(s.values))
        return []
      const values = Object.fromEntries(
        Object.entries(s.values).filter(([, v]) => typeof v === 'string')
      ) as Record<string, string>
      return [{ id: s.id, values }]
    }),
  }
}

export const useRevealedNotes = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: revealKeys.revealed(id),
    enabled,
    // Sai da memória ao fechar a ficha; sempre rebuscada ao voltar
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: enabled ? REVEALED_REFETCH_MS : false,
    queryFn: async ({ signal }) =>
      parseRevealed(
        unwrap(await api.characters({ id }).revealed.get({ fetch: { signal } }))
      ),
  })

export const useSetReveal = (characterId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      readonly clientCommandId: string
      readonly section: string
      readonly revealed: boolean
      readonly revision: number
    }) => unwrap(await api.characters({ id: characterId }).reveal.post(input)),
    // Pelo prefixo, a ficha leva junto o Histórico e a consulta revelada
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['characters', characterId] }),
    // Revisão velha (a ficha do cache restaurado): o erro fica na folha, e a
    // ficha rebusca o estado e a revisão atuais
    onError: error =>
      statusOf(error) === 409
        ? queryClient.invalidateQueries({
            queryKey: ['characters', characterId],
          })
        : undefined,
  })
}
