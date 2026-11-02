import { act, fireEvent, screen } from '@testing-library/react-native'
import { Modal } from 'react-native'

/**
 * O campo de texto com o rótulo. No app, a linha do Editar que abre a folha
 * tem o mesmo nome do campo ("Nome", com o valor à parte: T-61), então
 * `getByLabelText` acha os dois.
 */
export function textInput(label: string) {
  const found = screen
    .getAllByLabelText(label)
    // Com os tipos do react-test-renderer, o tipo não lista os componentes
    // nativos: 'TextInput' é string do host
    .filter(el => (el.type as unknown) === 'TextInput')
  if (found.length !== 1)
    throw new Error(`${found.length} campos de texto "${label}"`)
  return found[0] as (typeof found)[number]
}

/**
 * O fim da animação de saída das folhas fechadas: o onDismiss do Modal, que
 * o mock não dispara. A folha seguinte de um menu abre depois dele.
 */
export async function sheetsDismissed() {
  for (const modal of screen.UNSAFE_getAllByType(Modal))
    if (!modal.props.visible) fireEvent(modal, 'dismiss')
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}
