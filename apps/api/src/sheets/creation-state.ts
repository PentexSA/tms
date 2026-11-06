import {
  type CreationChoices,
  type CreationConfigLayer,
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

/**
 * A entrada da conta da criação que a Mesa manda ao narrador (P09-D, R-15):
 * as escolhas do jogador e a camada da configuração, para o app fazer a mesma
 * conta da barra do jogador no cartão. Só no PC em criação por pontos
 * (`creating` ou `pending`); no resto, null. Montada por lista explícita:
 * nunca leva os marcadores do ciclo nem o motivo da devolução ou do ajuste.
 */
export function creationInputView(
  model: SheetModel,
  row: {
    readonly kind: string
    readonly status: string
    readonly creation: unknown
  }
): {
  readonly choices: CreationChoices
  readonly config: CreationConfigLayer
} | null {
  if (row.kind !== 'pc') return null
  if (row.status !== 'creating' && row.status !== 'pending') return null
  const parsed = parseCharacterCreation(model, row.creation)
  if (creationInputOf(model, parsed).config.mode !== 'points') return null
  return { choices: parsed.choices ?? {}, config: parsed.config ?? {} }
}
