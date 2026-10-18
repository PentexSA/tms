import { act, fireEvent, render, screen } from '@testing-library/react-native'

import { modelOf } from '../../test/fixtures'
import { CharacterForm } from '../CharacterForm'

// Etapa 14: o formulário de criação sai do template, sem campo fixo no código.

const setup = (system = 'vtm-v20', serverIssues = []) => {
  const onSubmit = jest.fn()
  render(
    <CharacterForm
      model={modelOf(system)}
      onSubmit={onSubmit}
      serverIssues={serverIssues}
    />
  )
  return onSubmit
}

describe('CharacterForm (Vampiro)', () => {
  it('mostra os campos de identidade do template, na ordem', () => {
    setup()
    const ids = screen
      .getAllByTestId(/^editor-/)
      .map(e => (e.props.testID as string).replace('editor-', ''))
    expect(ids).toEqual([
      'name',
      'clan',
      'concept',
      'generation',
      'sire',
      'nature',
      'demeanor',
    ])
    expect(screen.getByRole('radio', { name: 'Tremere' })).toBeTruthy()
    // Geração começa no padrão do template (13ª)
    expect(
      screen.getByRole('adjustable', { name: 'Geração' })
    ).toHaveAccessibilityValue({
      now: 13,
      text: '13ª geração',
    })
  })

  it('cria só com o que foi preenchido, aparado', async () => {
    const onSubmit = setup()
    fireEvent.changeText(screen.getByTestId('editor-name'), '  Helena Varga ')
    fireEvent.press(screen.getByRole('radio', { name: 'Tremere' }))
    fireEvent(
      screen.getByRole('adjustable', { name: 'Geração' }),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'decrement' },
      }
    )
    fireEvent.changeText(screen.getByTestId('editor-concept'), '   ')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Helena Varga',
      clan: 'tremere',
      generation: 12,
    })
  })

  it('sem nome, avisa no campo e não envia', () => {
    const onSubmit = setup()
    fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome')
    expect(onSubmit).not.toHaveBeenCalled()
    // Digitar limpa o erro do campo
    fireEvent.changeText(screen.getByTestId('editor-name'), 'H')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('o validador do core roda antes de enviar', () => {
    const onSubmit = setup()
    fireEvent.changeText(screen.getByTestId('editor-name'), 'x'.repeat(80))
    fireEvent.changeText(screen.getByTestId('editor-nature'), 'n'.repeat(40))
    fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('o erro do servidor volta para o campo', () => {
    setup('vtm-v20', [
      { path: '/values/clan', message: 'opção inexistente' },
    ] as never)
    expect(screen.getByRole('alert')).toHaveTextContent('opção inexistente')
  })

  it('o nome tem o limite do template', () => {
    setup()
    expect(screen.getByTestId('editor-name').props.maxLength).toBe(80)
    expect(screen.getAllByText('0/80').length).toBeGreaterThan(0)
  })
})

describe('CharacterForm (outro sistema: D&D 5e)', () => {
  it('mostra os campos de identidade do D&D, sem nada do Vampiro', () => {
    setup('dnd5e-2014')
    const ids = screen
      .getAllByTestId(/^editor-/)
      .map(e => (e.props.testID as string).replace('editor-', ''))
    expect(ids).toContain('class')
    expect(ids).toContain('race')
    expect(ids).toContain('level')
    expect(ids).not.toContain('clan')
    expect(screen.getByRole('radio', { name: 'Mago' })).toBeTruthy()
  })
})
