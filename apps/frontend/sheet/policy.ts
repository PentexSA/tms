import {
  type ChangeClass,
  type RefusalCode,
  type RoleName,
  type SheetModel,
  writePolicy,
} from '@tms/sheet-core'
import { createContext, useContext } from 'react'

// Estado da ficha e a política de escrita no app (doc/painel-narrador.md §5.1;
// doc/plano-v3.md, Etapa 6). O servidor é a autoridade: aqui a mesma
// `writePolicy` do core só desabilita o que ele vai recusar, com o motivo no
// lugar, e a recusa que chega (403 com `code`) vira uma frase.

export interface SheetLifecycle {
  readonly status: string
  readonly locked: boolean
  // O dono ainda tem o vínculo na crônica (o ex-membro chega na Etapa 7)
  readonly member: boolean
}

// Sem estado conhecido (prévias, testes antigos): o comportamento de antes
const OPEN: SheetLifecycle = { status: 'creating', locked: false, member: true }

export const LifecycleContext = createContext<SheetLifecycle>(OPEN)

export const useLifecycle = (): SheetLifecycle => useContext(LifecycleContext)

const REFUSAL_CODES: readonly RefusalCode[] = [
  'SHEET_LOCKED',
  'SHEET_NOT_EDITABLE',
  'NEEDS_XP_APPROVAL',
  'NOT_MEMBER',
  'FORBIDDEN',
]

/** O código de recusa de um 403 da política; o corpo é input hostil. */
export function refusalCodeOf(body: unknown): RefusalCode | null {
  const code = (body as { code?: unknown } | null)?.code
  return (REFUSAL_CODES as readonly unknown[]).includes(code)
    ? (code as RefusalCode)
    : null
}

// O porquê de cada recusa, sem o que aconteceu com a alteração. FORBIDDEN não
// tem frase própria: o app usa a genérica de antes.
const WHY: Readonly<Record<Exclude<RefusalCode, 'FORBIDDEN'>, string>> = {
  SHEET_LOCKED: 'O narrador travou a ficha.',
  SHEET_NOT_EDITABLE:
    'A ficha está arquivada ou fora de jogo: só o narrador muda isto agora.',
  NEEDS_XP_APPROVAL: 'Depois da criação, subir um traço passa pelo narrador.',
  NOT_MEMBER: 'Você saiu desta crônica: a ficha é só leitura.',
}

/** A frase de uma recusa; null para FORBIDDEN, que usa a genérica. */
export const refusalReason = (code: RefusalCode | null): string | null =>
  code && code !== 'FORBIDDEN' ? WHY[code] : null

/** O rótulo de `dead` vem do template ("Torpor"); sem ele, "Fora de jogo". */
export const deadLabel = (model: SheetModel): string =>
  model.template.statusLabels?.dead ?? 'Fora de jogo'

/** O que a política diria de uma mudança desta classe, ou null se passa. */
export function blockedBy(
  roles: ReadonlySet<RoleName>,
  lifecycle: SheetLifecycle,
  cls: ChangeClass
): RefusalCode | null {
  const verdict = writePolicy(
    {
      owner: roles.has('owner'),
      storyteller: roles.has('storyteller'),
      member: lifecycle.member,
    },
    lifecycle.status,
    lifecycle.locked,
    [cls]
  )
  return verdict.ok ? null : verdict.code
}

// O motivo curto, ao lado do controle desabilitado.
const NOTE: Readonly<Record<RefusalCode, string>> = {
  SHEET_LOCKED: 'O narrador travou a ficha.',
  SHEET_NOT_EDITABLE: 'Só o narrador muda esta ficha agora.',
  NEEDS_XP_APPROVAL: 'Peça ao narrador.',
  NOT_MEMBER: 'Você saiu desta crônica.',
  FORBIDDEN: 'Você não pode alterar este campo.',
}

export const blockedNote = (code: RefusalCode): string => NOTE[code]
