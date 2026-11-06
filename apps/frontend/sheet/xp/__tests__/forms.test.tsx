import { fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'
import type { useXpCommands } from '../../../lib/queries/xp'
import { AdjustForm, GrantForm } from '../forms'

// U-02: "Conceder XP" e "Ajustar XP" aceitam o valor digitado, como o
// "Digitar" do Editar (T-25).

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => setOS(realOS))

const commands = () => {
  const run = jest.fn(async () => ({ status: 'done' as const, data: {} }))
  return {
    run,
    value: { run, unconfirmed: [] } as unknown as ReturnType<
      typeof useXpCommands
    >,
  }
}

const typeAmount = (label: string, text: string) => {
  fireEvent.press(screen.getByRole('button', { name: `Digitar ${label}` }))
  const input = screen.getByLabelText(new RegExp(`^${label}, de `))
  fireEvent.changeText(input, text)
  return input
}

describe('Conceder XP: Digitar (U-02)', () => {
  it('"Digitar XP a conceder" → 10 → Enter vale 10, e a concessão leva 10', async () => {
    setOS('web')
    const { run, value } = commands()
    render(
      <GrantForm chronicleId="c1" characterIds={['p1']} commands={value} />
    )
    const input = typeAmount('XP a conceder', '10')
    fireEvent(input, 'submitEditing', { nativeEvent: { text: '10' } })
    expect(screen.queryByLabelText(/^XP a conceder, de /)).toBeNull()
    expect(screen.getByTestId('xp-grant-amount')).toHaveTextContent(/10/)
    fireEvent.changeText(screen.getByLabelText('Motivo'), 'Sessão 12')
    fireEvent.press(screen.getByRole('button', { name: 'Conceder XP' }))
    await screen.findByRole('button', { name: 'Conceder XP' })
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'grant',
        body: expect.objectContaining({ amount: 10 }),
      })
    )
  })

  it('1001 mostra a mensagem e, com Enter, o campo fica aberto; sair do campo não aplica', () => {
    setOS('web')
    render(
      <GrantForm
        chronicleId="c1"
        characterIds={['p1']}
        commands={commands().value}
      />
    )
    const input = typeAmount('XP a conceder', '1001')
    fireEvent(input, 'submitEditing', { nativeEvent: { text: '1001' } })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Digite um número inteiro de 1 a 1000'
    )
    expect(screen.getByLabelText(/^XP a conceder, de /)).toBeTruthy()
    fireEvent(input, 'blur', { nativeEvent: { text: '1001' } })
    expect(screen.queryByLabelText(/^XP a conceder, de /)).toBeNull()
    expect(screen.getByTestId('xp-grant-amount')).not.toHaveTextContent(/1001/)
  })

  it('Esc volta ao valor de antes, sem mensagem', () => {
    setOS('web')
    render(
      <GrantForm
        chronicleId="c1"
        characterIds={['p1']}
        commands={commands().value}
      />
    )
    const input = typeAmount('XP a conceder', '50')
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Escape' } })
    expect(screen.queryByLabelText(/^XP a conceder, de /)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByTestId('xp-grant-amount')).not.toHaveTextContent(/50/)
  })

  it('no app, a ação "activate" do controle abre o campo, com o teclado numérico', () => {
    setOS('android')
    render(
      <GrantForm
        chronicleId="c1"
        characterIds={['p1']}
        commands={commands().value}
      />
    )
    fireEvent(
      screen.getByRole('adjustable', { name: 'XP a conceder' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'activate' } }
    )
    expect(
      screen.getByLabelText('XP a conceder, de 1 a 1000').props.keyboardType
    ).toBe('number-pad')
  })
})

describe('Ajustar XP: Digitar (U-02)', () => {
  it('−5 digitado vale, e o ajuste leva −5', async () => {
    setOS('web')
    const { run, value } = commands()
    render(
      <AdjustForm
        chronicleId="c1"
        characterId="p1"
        grants={[]}
        commands={value}
      />
    )
    const input = typeAmount('Ajuste no total', '-5')
    fireEvent(input, 'submitEditing', { nativeEvent: { text: '-5' } })
    fireEvent.changeText(screen.getByLabelText('Motivo'), 'Correção')
    fireEvent.press(screen.getByRole('button', { name: 'Ajustar XP' }))
    await screen.findByRole('button', { name: 'Ajustar XP' })
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'adjust',
        body: expect.objectContaining({ delta: -5 }),
      })
    )
  })

  it('no iOS, o teclado tem o sinal de menos', () => {
    setOS('ios')
    render(
      <AdjustForm
        chronicleId="c1"
        characterId="p1"
        grants={[]}
        commands={commands().value}
      />
    )
    fireEvent(
      screen.getByRole('adjustable', { name: 'Ajuste no total' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'activate' } }
    )
    expect(
      screen.getByLabelText('Ajuste no total, de -1000 a 1000').props
        .keyboardType
    ).toBe('numbers-and-punctuation')
  })
})
