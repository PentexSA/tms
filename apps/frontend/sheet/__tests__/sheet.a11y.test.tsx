import { fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { modelOf } from '../../test/fixtures'
import { CharacterForm } from '../CharacterForm'
import { RadioChips } from '../creation/RadioChips'

// Acessibilidade da ficha (P06 da onda 1): um teste de regressão por bug.

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => setOS(realOS))

const keyDown = (key: string) => ({
  nativeEvent: { key, repeat: false },
  preventDefault: jest.fn(),
})

const form = (system: string) =>
  render(
    <CharacterForm
      model={modelOf(system)}
      onSubmit={jest.fn()}
      serverIssues={[]}
    />
  )

describe('Nova ficha: título visível nos grupos de escolha (T-09)', () => {
  it('Vampiro: "Clã" acima da grade; o Clã continua opcional', () => {
    form('vtm-v20')
    expect(screen.getByText('Clã')).toBeTruthy()
    expect(screen.getByLabelText('Clã')).toBeTruthy()
    expect(screen.queryByText(/Clã.*obrigatório/)).toBeNull()
  })

  it('Lobisomem: "Raça", "Augúrio" e "Tribo"', () => {
    form('wta-w20')
    for (const title of ['Raça', 'Augúrio', 'Tribo']) {
      expect(screen.getByText(title)).toBeTruthy()
    }
  })
})

describe('Prioridades no web: setas só movem o foco (T-35)', () => {
  it('a seta não grava a prioridade; o Espaço grava', () => {
    setOS('web')
    const onChange = jest.fn()
    render(
      <RadioChips
        label="Físicos"
        value="primary"
        onChange={onChange}
        options={[
          { id: 'primary', label: '7' },
          { id: 'secondary', label: '5' },
          { id: 'tertiary', label: '3' },
        ]}
      />
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.props.tabIndex)).toEqual([0, -1, -1])
    fireEvent(
      screen.getByRole('radio', { name: '7' }),
      'keyDown',
      keyDown('ArrowRight')
    )
    expect(onChange).not.toHaveBeenCalled()
    fireEvent(screen.getByRole('radio', { name: '5' }), 'keyDown', keyDown(' '))
    expect(onChange).toHaveBeenCalledWith('secondary')
  })
})
