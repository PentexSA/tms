import { parsePath, type SheetModel } from '@tms/sheet-core'
import { messageOf } from '../../lib/errors'

export interface OperationCharacter {
  readonly name: string
  readonly model: SheetModel | null | undefined
}

/** Nunca apresenta caminhos de implementação ao narrador. */
export function operationError(
  error: unknown,
  characters: ReadonlyMap<string, OperationCharacter>
): string {
  const body = (
    error as {
      value?: {
        code?: string
        conflicts?: { characterId: string; paths: string[] }[]
      }
    } | null
  )?.value
  if (body?.code !== 'REVERT_CONFLICT') return messageOf(error)
  return (body.conflicts ?? [])
    .map(c => {
      const character = characters.get(c.characterId)
      const labels = c.paths
        .map(path => {
          const parsed = parsePath(path)
          return (
            parsed && character?.model?.fields.get(parsed.fieldId)?.def.label
          )
        })
        .filter(Boolean)
      return `${labels.length ? labels.join(', ') : 'A ficha'} de ${character?.name ?? 'um personagem'} mudou depois; edite à mão.`
    })
    .join(' ')
}
