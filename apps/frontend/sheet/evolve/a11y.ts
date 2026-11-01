import { Platform } from 'react-native'

// Nome e valor acessíveis de uma linha "Rótulo: valor" (T-61). No app, o
// rótulo é só o nome do campo e o valor vai no accessibilityValue: com os
// dois no rótulo, o leitor dizia "Nome: X, X". No web, o react-native-web
// descarta o accessibilityValue, então o valor fica no rótulo ("Nome: X").
// Nos dois, o nome começa pelo texto visível (matriz de views, WCAG 2.5.3).

export function fieldA11y(
  label: string,
  value: string
): {
  readonly accessibilityLabel: string
  readonly accessibilityValue?: { readonly text: string }
} {
  return Platform.OS === 'web'
    ? { accessibilityLabel: `${label}: ${value}` }
    : { accessibilityLabel: label, accessibilityValue: { text: value } }
}
