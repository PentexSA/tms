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

const normalizeCharacter = (value: unknown) => {
  if (
    value &&
    typeof value === 'object' &&
    !('projection' in value) &&
    'sheet' in value
  )
    return {
      ...value,
      projection: 'full' as const,
      kind: 'pc' as const,
      visibility: 'hidden' as const,
      visibilityRevision: 0,
      presentationRevision: 0,
      identity: {
        name:
          'name' in value && typeof value.name === 'string'
            ? value.name
            : 'Personagem',
      },
    }
  return value
}

export const useCharacter = (id: string) =>
  useQuery({
    queryKey: sheetKeys.character(id),
    queryFn: async ({ signal }) =>
      normalizeCharacter(
        unwrap(await api.characters({ id }).get({ fetch: { signal } }))
      ) as Awaited<ReturnType<typeof api.characters>> extends never
        ? never
        : NonNullable<
            Awaited<
              ReturnType<ReturnType<typeof api.characters>['get']>
            >['data']
          >,
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
type IdentityCharacterData = Extract<CharacterData, { projection: 'identity' }>
type FullCharacterData = Extract<CharacterData, { projection: 'full' }>
type EditableCharacterData = FullCharacterData & {
  readonly creation: object
  readonly sheetVersion: number
  readonly member: boolean
  readonly owner: { readonly username: string }
  readonly name: string
}

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
      readonly status: 'identity'
      readonly character: IdentityCharacterData
    }
  | {
      readonly status: 'viewer'
      readonly model: SheetModel
      readonly sheet: SheetData
      readonly roles: readonly RoleName[]
      readonly character: FullCharacterData
    }
  | {
      readonly status: 'ready'
      readonly model: SheetModel
      readonly sheet: SheetData
      readonly roles: readonly RoleName[]
      readonly character: EditableCharacterData
    }

export function useSheetData(id: string): SheetState {
  const character = useCharacter(id)
  const full =
    character.data?.projection === 'full' ? character.data : undefined
  const template = useTemplate(full?.systemCode, full?.templateVersion)
  const compiled = useCompiled(template.data)
  const parsed = useMemo(
    () => (compiled && full ? parseSheet(compiled, full.sheet) : undefined),
    [compiled, full]
  )

  // Com a ficha em mãos (cache, disco), um refetch que falha não tira a
  // ficha da tela: offline, ela continua jogável; a fila sincroniza depois
  const cachedViewer =
    character.data?.projection === 'identity' ||
    (character.data?.projection === 'full' &&
      character.data.roles.includes('viewer'))
  if (character.isError && (!character.data || cachedViewer))
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
  if (character.data?.projection === 'identity')
    return { status: 'identity', character: character.data }
  if (compiled === null) return { status: 'unsupported' }
  if (!full || !compiled || !parsed) return { status: 'loading' }
  if (!parsed.ok) return { status: 'invalid' }
  if (full.roles.includes('viewer'))
    return {
      status: 'viewer',
      model: compiled,
      sheet: parsed.value,
      roles: full.roles as readonly RoleName[],
      character: full,
    }
  return {
    status: 'ready',
    model: compiled,
    sheet: parsed.value,
    roles: full.roles as RoleName[],
    character: full as EditableCharacterData,
  }
}
