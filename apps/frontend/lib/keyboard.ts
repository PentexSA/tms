import { Platform } from 'react-native'

// Tecla de ação do teclado nos campos de uma linha (T-10, T-26).
//
// `submitBehavior: 'submit'`: Enter (ou "Próximo"/"✓") chama o
// onSubmitEditing sem tirar o foco, então o teclado não pisca entre um campo
// e o seguinte, e com erro o campo fica aberto. No web, o mesmo efeito é o
// `blurOnSubmit={false}` do react-native-web.

type ReturnKey = 'next' | 'done' | 'go'

export function submitField(returnKeyType: ReturnKey, onSubmit: () => void) {
  return {
    returnKeyType,
    submitBehavior: 'submit',
    ...(Platform.OS === 'web' ? { blurOnSubmit: false } : {}),
    onSubmitEditing: onSubmit,
  } as const
}

/** "Próximo": o Enter leva ao campo seguinte, sem enviar o formulário. */
export const nextField = (focusNext: () => void) =>
  submitField('next', focusNext)
