import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'

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
    // O nome, os textos curtos em pares (na ordem da ficha impressa) e o Clã
    expect(ids).toEqual([
      'name',
      'nature',
      'demeanor',
      'concept',
      'sire',
      'clan',
    ])
    expect(screen.getByRole('radio', { name: 'Tremere' })).toBeTruthy()
    // A Geração sai do antecedente: não se escolhe na criação
    expect(screen.queryByRole('adjustable', { name: 'Geração' })).toBeNull()
  })

  it('Natureza | Comportamento e Conceito | Senhor dividem a linha', () => {
    setup()
    // Sobe do campo `a` até a primeira View que também contém `b`: a linha
    const rowWith = (a: string, b: string) => {
      let x = screen.getByTestId(`editor-${a}`).parent
      while (x && !within(x).queryByTestId(`editor-${b}`)) x = x.parent
      if (!x) throw new Error(`${a} e ${b} não têm linha em comum`)
      return x
    }
    const first = rowWith('nature', 'demeanor')
    expect(within(first).queryByTestId('editor-concept')).toBeNull()
    const second = rowWith('concept', 'sire')
    expect(within(second).queryByTestId('editor-nature')).toBeNull()
  })

  it('cria só com o que foi preenchido, aparado', async () => {
    const onSubmit = setup()
    fireEvent.changeText(screen.getByTestId('editor-name'), '  Helena Varga ')
    fireEvent.press(screen.getByRole('radio', { name: 'Tremere' }))
    fireEvent.changeText(screen.getByTestId('editor-concept'), '   ')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Helena Varga',
      clan: 'tremere',
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

// T-21: "Criar ficha" com erro leva ao primeiro campo inválido, na ordem da
// tela: o formulário diz o `y` da linha (a tela rola) e foca o campo de texto
describe('Criar ficha leva ao erro (T-21)', () => {
  const { TextInput } = jest.requireActual('react-native')
  const focused = () =>
    (
      jest.mocked(TextInput.prototype.focus).mock.contexts as {
        props: { testID?: string }
      }[]
    ).map(c => c.props.testID)
  const layout = (row: string, y: number) =>
    fireEvent(screen.getByTestId(`form-row-${row}`), 'layout', {
      nativeEvent: { layout: { x: 0, y, width: 360, height: 72 } },
    })
  beforeEach(() => jest.mocked(TextInput.prototype.focus).mockClear())

  it('com o nome vazio, rola até a linha do nome e foca o campo', () => {
    const onInvalid = jest.fn()
    const onSubmit = jest.fn()
    render(
      <CharacterForm
        model={modelOf('vtm-v20')}
        onSubmit={onSubmit}
        onInvalid={onInvalid}
      />
    )
    layout('name', 12)
    layout('concept-sire', 180)
    fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(onInvalid).toHaveBeenCalledWith(12)
    expect(focused()).toEqual(['editor-name'])
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome')
  })

  it('com o 422 do servidor no Conceito, faz o mesmo para o Conceito', () => {
    const onInvalid = jest.fn()
    const { rerender } = render(
      <CharacterForm
        model={modelOf('vtm-v20')}
        onSubmit={jest.fn()}
        onInvalid={onInvalid}
      />
    )
    layout('concept-sire', 180)
    expect(onInvalid).not.toHaveBeenCalled()
    rerender(
      <CharacterForm
        model={modelOf('vtm-v20')}
        onSubmit={jest.fn()}
        onInvalid={onInvalid}
        serverIssues={[{ path: '/values/concept', message: 'longo demais' }]}
      />
    )
    expect(onInvalid).toHaveBeenCalledWith(180)
    expect(focused()).toEqual(['editor-concept'])
    // O mesmo erro de servidor num render qualquer não rola de novo; uma
    // resposta nova com a mesma recusa (lista nova) leva ao campo de novo
    const same = [{ path: '/values/concept', message: 'longo demais' }]
    const form = (issues: typeof same) => (
      <CharacterForm
        model={modelOf('vtm-v20')}
        onSubmit={jest.fn()}
        onInvalid={onInvalid}
        serverIssues={issues}
      />
    )
    rerender(form(same))
    expect(onInvalid).toHaveBeenCalledTimes(2)
    rerender(form(same))
    expect(onInvalid).toHaveBeenCalledTimes(2)
    rerender(form([...same]))
    expect(onInvalid).toHaveBeenCalledTimes(3)
  })

  it('erro num campo de escolha rola até ele, sem foco de texto', () => {
    const onInvalid = jest.fn()
    render(
      <CharacterForm
        model={modelOf('vtm-v20')}
        onSubmit={jest.fn()}
        onInvalid={onInvalid}
        serverIssues={[{ path: '/values/clan', message: 'opção inexistente' }]}
      />
    )
    // Sem layout ainda: a linha vale 0
    expect(onInvalid).toHaveBeenCalledWith(0)
    expect(focused()).toEqual([])
  })
})
