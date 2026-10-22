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

/** A consulta de uma versão de template: a Mesa pede várias de uma vez. */
export const templateQuery = (code: string, version: string) => ({
  queryKey: sheetKeys.template(code, version),
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  queryFn: async ({ signal }: { readonly signal: AbortSignal }) =>
    unwrap(
      await api.systems({ code }).template.get({
        query: { version },
        fetch: { signal },
      })
    ) as unknown,
})

export const useTemplate = (code?: string, version?: string) =>
  useQuery({
    ...templateQuery(code ?? '', version ?? ''),
    enabled: Boolean(code && version),
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

// Um modelo por JSON de template: o mesmo objeto enquanto o cache guarda o
// JSON (versão publicada é imutável), para quem memoiza por identidade
const compiled = new WeakMap<object, SheetModel | null>()

/** Compila sem lançar: null quando esta versão do app não entende o template. */
export function compileSafe(json: unknown): SheetModel | null | undefined {
  if (json === undefined) return undefined
  const cached =
    json && typeof json === 'object' ? compiled.get(json) : undefined
  if (cached !== undefined) return cached
  let model: SheetModel | null
  try {
    model = compileTemplate(json)
  } catch (e) {
    if (!(e instanceof UnsupportedTemplateError)) throw e
    model = null
  }
  if (json && typeof json === 'object') compiled.set(json, model)
  return model
}

export function useCompiled(json: unknown): SheetModel | null | undefined {
  return useMemo(() => compileSafe(json), [json])
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

  // Com a ficha em mãos (cache, disco), um refetch que falha não tira a
  // ficha da tela: offline, ela continua jogável; a fila sincroniza depois
  if (character.isError && !character.data)
    return {
      status: 'error',
      error: character.error,
      retry: () => character.refetch(),
    }
  if (template.isError && template.data === undefined)
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
