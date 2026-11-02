import {
  creationInputOf,
  parseCharacterCreation,
  type SheetModel,
} from '@tms/sheet-core'

// O estado da criação que a lista da crônica e a Mesa mandam (P04-D, R-12):
// só booleanos e o modo, nunca o motivo da devolução ou do ajuste, que fica
// no GET /characters/:id para o dono e o narrador.

export interface CreationFlags {
  // T-06: o narrador devolveu a ficha enviada
  readonly returned: boolean
  // D-04: o narrador pediu ajuste
  readonly adjust: boolean
  // D-03: o dono avisou que terminou
  readonly ready: boolean
}

const obj = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null

const reasonMark = (v: unknown) => {
  const r = obj(v)
  return r !== null && typeof r.reason === 'string' && typeof r.at === 'string'
}

/**
 * Os marcadores na mesma forma que `parseCharacterCreation` aceita (motivo e
 * data em texto; a data do aviso em texto), sem validar as escolhas e a
 * configuração de cada linha da lista só para três booleanos.
 */
export function creationFlags(creation: unknown): CreationFlags {
  const c = obj(creation)
  return {
    returned: reasonMark(c?.returned),
    adjust: reasonMark(c?.adjust),
    ready: typeof obj(c?.ready)?.at === 'string',
  }
}

/**
 * O que a lista e a Mesa mandam do ciclo da criação: os marcadores só valem
 * em `creating`, e o modo (livre ou por pontos) só em `creating` e
 * `pending`, onde o selo "Em criação · …" e a conta dependem dele.
 */
export function creationStateOf(
  model: SheetModel,
  status: string,
  creation: unknown
) {
  const creating = status === 'creating'
  const flags = creationFlags(creation)
  return {
    creationMode:
      creating || status === 'pending'
        ? creationInputOf(model, parseCharacterCreation(model, creation)).config
            .mode
        : null,
    returned: creating && flags.returned,
    adjust: creating && flags.adjust,
    ready: creating && flags.ready,
  }
}
