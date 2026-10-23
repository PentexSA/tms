import {
  compileTemplate,
  poolOptions,
  poolRollOf,
  resolve,
  type SheetData,
} from '@tms/sheet-core'
import { template } from './factories'

// O que a matriz de AuthZ precisa de cada sistema, tirado do template e de uma
// ficha de exemplo: a matriz não cita nome de campo nem de sistema
// (doc/plano-v3.md, Etapa 3).

export const MATRIX_SYSTEMS = ['vtm-v20', 'mta-m20', 'wta-w20'] as const

export interface SystemCase {
  readonly system: string
  /** Campo de texto da identidade que o dono escreve (não o nome). */
  readonly textField: string
  /** Os slots de uma rolagem sem custo: a primeira opção do primeiro slot. */
  readonly slots: Readonly<Record<string, string>>
  /** O campo de texto de uma seção que só o narrador lê. */
  readonly notesField: string
  /** Um traço (`rating`) da zona de construção: o alvo de um pedido de XP. */
  readonly ratingField: string
}

export function systemCase(system: string): SystemCase {
  const model = compileTemplate(template(system))
  const nameField = model.template.identity.name
  const textField = model.identityFields.find(id => {
    const f = model.fields.get(id)
    return id !== nameField && f?.def.type === 'text'
  })
  const roll = poolRollOf(model)
  const slot = roll?.slots[0]
  const sheet = { values: { [nameField]: 'Ficha' } } as SheetData
  const option = slot
    ? poolOptions(model, resolve(model, sheet), slot, ['owner'])[0]
    : undefined
  const notesField = [...model.sections.values()]
    .filter(s => s.def.permissions?.read?.every(r => r === 'storyteller'))
    .flatMap(s => s.fieldIds)
    .find(id => {
      const t = model.fields.get(id)?.def.type
      return t === 'text' || t === 'longText'
    })
  const ratingField = [...model.fields.values()].find(
    f => f.type === 'rating' && f.zone === 'build'
  )?.id
  if (!textField || !slot || !option || !notesField || !ratingField)
    throw new Error(`${system}: o template não tem o que a matriz precisa`)
  return {
    system,
    textField,
    slots: { [slot.id]: option.key },
    notesField,
    ratingField,
  }
}
