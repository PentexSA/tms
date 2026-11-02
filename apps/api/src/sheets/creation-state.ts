import {
  creationInputOf,
  parseCharacterCreation,
  type SheetModel,
} from '@tms/sheet-core'

// O estado da criação que a lista da crônica e a Mesa mandam (P04-D, R-12):
// o modo e os marcadores (devolvida, ajuste pedido, avisou que terminou), só
// booleanos, nunca o motivo da devolução ou do ajuste, que fica no
// GET /characters/:id para o dono e o narrador. Um parse só, o mesmo do
// GET da ficha (`parseCharacterCreation`), e só onde importa: os marcadores
// valem em `creating`, e o modo em `creating` e `pending`.

export function creationStateOf(
  model: SheetModel,
  status: string,
  creation: unknown
) {
  if (status !== 'creating' && status !== 'pending')
    return { creationMode: null, returned: false, adjust: false, ready: false }
  const parsed = parseCharacterCreation(model, creation)
  const creating = status === 'creating'
  return {
    creationMode: creationInputOf(model, parsed).config.mode,
    returned: creating && parsed.returned !== undefined,
    adjust: creating && parsed.adjust !== undefined,
    ready: creating && parsed.ready !== undefined,
  }
}
