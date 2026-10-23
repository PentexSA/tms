import type { DB } from '@tms/db'
import {
  type ChangePart,
  canRead,
  type PolicyResult,
  parsePath,
  type RefusalCode,
  type RoleName,
  type SheetData,
  type SheetModel,
  type WriteAccess,
} from '@tms/sheet-core'
import type { Transaction } from 'kysely'
import { ApiError } from '../http/errors'

// A política de escrita no servidor (doc/painel-narrador.md §5.1; doc/plano-v3.md,
// Etapa 5). Vale o estado de quando o lote chega: tudo aqui roda dentro da
// transação, depois do `FOR UPDATE` na ficha. A tabela é a do core
// (`writePolicy`, `rollPolicy`); aqui só se lê o banco e se monta a recusa.

const REFUSALS: Readonly<Record<RefusalCode, string>> = {
  SHEET_LOCKED: 'o narrador travou a ficha',
  SHEET_NOT_EDITABLE: 'a ficha não aceita alterações do dono neste estado',
  NEEDS_XP_APPROVAL: 'depois da criação, evoluir passa pelo narrador',
  NOT_MEMBER: 'você não faz mais parte desta crônica',
  FORBIDDEN: 'sem permissão de escrita',
}

export interface LockedCharacter {
  readonly chronicleId: string
  readonly userId: string
  readonly sheet: SheetData
  readonly sheetVersion: number
  readonly status: string
  readonly lockedAt: Date | null
  readonly creationCompletedAt: Date | null
}

const notFound = () => new ApiError(404, 'não encontrado')

const date = (v: Date | string | null): Date | null =>
  v === null ? null : new Date(v)

/** Trava a linha da ficha até o fim da transação. Excluída: 404. */
export async function lockCharacter(
  trx: Transaction<DB>,
  id: string
): Promise<LockedCharacter> {
  const row = await trx
    .selectFrom('characters')
    .select([
      'chronicle_id',
      'user_id',
      'sheet_data',
      'sheet_version',
      'deleted_at',
      'status',
      'locked_at',
      'creation_completed_at',
    ])
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirstOrThrow()
  if (row.deleted_at !== null) throw notFound()
  return {
    chronicleId: row.chronicle_id,
    userId: row.user_id,
    sheet: row.sheet_data as unknown as SheetData,
    sheetVersion: row.sheet_version,
    status: row.status,
    lockedAt: date(row.locked_at),
    creationCompletedAt: date(row.creation_completed_at),
  }
}

/**
 * O acesso que a política lê. O vínculo é relido aqui, sem travá-lo: o dono
 * removido da crônica continua com `owner` no `characterAccess` (lê a ficha),
 * mas a política o trata como ex-membro.
 */
export async function writeAccess(
  trx: Transaction<DB>,
  roles: ReadonlySet<RoleName>,
  chronicleId: string,
  userId: string
): Promise<WriteAccess> {
  const owner = roles.has('owner')
  const storyteller = roles.has('storyteller')
  const member =
    storyteller ||
    (owner &&
      (await trx
        .selectFrom('chronicle_members')
        .select('user_id')
        .where('chronicle_id', '=', chronicleId)
        .where('user_id', '=', userId)
        .executeTakeFirst()) !== undefined)
  return { owner, storyteller, member }
}

/**
 * O 403 da política: o código e os caminhos recusados (os do lote e as partes
 * que pesaram, como a FdV que a tribo mudaria), nunca o valor. Só vão os
 * caminhos de campos que quem pediu pode ler.
 */
export function refusal(
  result: Extract<PolicyResult, { ok: false }>,
  args: {
    readonly model: SheetModel
    readonly roles: ReadonlySet<RoleName>
    readonly paths: readonly string[]
    readonly parts?: readonly ChangePart[]
  }
): ApiError {
  const weighed =
    result.code === 'NEEDS_XP_APPROVAL'
      ? (args.parts ?? []).filter(p => p.kind === 'advance')
      : (args.parts ?? [])
  const paths = [
    ...new Set([...args.paths, ...weighed.map(p => p.path)]),
  ].filter(path => {
    const p = parsePath(path.split('#')[0])
    return p !== null && canRead(args.model, p.fieldId, args.roles)
  })
  return new ApiError(403, REFUSALS[result.code], {
    code: result.code,
    paths,
  })
}
