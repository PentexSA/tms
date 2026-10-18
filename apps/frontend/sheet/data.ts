import { useQuery } from '@tanstack/react-query'
import {
  compileTemplate,
  parseSheet,
  type RoleName,
  type SheetData,
  type SheetModel,
  UnsupportedTemplateError,
} from '@tms/sheet-core'
import { useMemo } from 'react'

import { api, unwrap } from '../lib/api'

// A ficha e o template da versão dela. O template é imutável por versão: fica
// em cache para sempre. Tudo o que chega passa pelo core antes da tela (o que
// vem da rede ou do disco é input hostil, doc/arquitetura §7.2).

export const sheetKeys = {
  character: (id: string) => ['characters', id] as const,
  template: (code: string, version: string) =>
    ['templates', code, version] as const,
}

export const useCharacter = (id: string) =>
  useQuery({
    queryKey: sheetKeys.character(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.characters({ id }).get({ fetch: { signal } })),
  })

export const useTemplate = (code?: string, version?: string) =>
  useQuery({
    queryKey: sheetKeys.template(code ?? '', version ?? ''),
    enabled: Boolean(code && version),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.systems({ code: code ?? '' }).template.get({
          query: { version },
          fetch: { signal },
        })
      ) as unknown,
  })

/** O template publicado mais recente do sistema (criação de ficha). */
export const useLatestTemplate = (code?: string) =>
  useQuery({
    queryKey: ['templates', code ?? '', 'latest'] as const,
    enabled: Boolean(code),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.systems({ code: code ?? '' }).template.get({
          query: {},
          fetch: { signal },
        })
      ) as unknown,
  })

/** Compila sem lançar: null quando esta versão do app não entende o template. */
export function useCompiled(json: unknown): SheetModel | null | undefined {
  return useMemo(() => {
    if (json === undefined) return undefined
    try {
      return compileTemplate(json)
    } catch (e) {
      if (e instanceof UnsupportedTemplateError) return null
      throw e
    }
  }, [json])
}

export type CharacterData = NonNullable<ReturnType<typeof useCharacter>['data']>

export type SheetState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'error'
      readonly error: unknown
      readonly retry: () => void
    }
  | { readonly status: 'unsupported' }
  | { readonly status: 'invalid' }
  | {
      readonly status: 'ready'
      readonly model: SheetModel
      readonly sheet: SheetData
      readonly roles: readonly RoleName[]
      readonly character: CharacterData
    }

export function useSheetData(id: string): SheetState {
  const character = useCharacter(id)
  const template = useTemplate(
    character.data?.systemCode,
    character.data?.templateVersion
  )
  const compiled = useCompiled(template.data)
  const parsed = useMemo(
    () =>
      compiled && character.data
        ? parseSheet(compiled, character.data.sheet)
        : undefined,
    [compiled, character.data]
  )

  if (character.isError)
    return {
      status: 'error',
      error: character.error,
      retry: () => character.refetch(),
    }
  if (template.isError)
    return {
      status: 'error',
      error: template.error,
      retry: () => template.refetch(),
    }
  if (compiled === null) return { status: 'unsupported' }
  if (!character.data || !compiled || !parsed) return { status: 'loading' }
  if (!parsed.ok) return { status: 'invalid' }
  return {
    status: 'ready',
    model: compiled,
    sheet: parsed.value,
    roles: character.data.roles as RoleName[],
    character: character.data,
  }
}
