import { render, screen } from '@testing-library/react-native'

import { modelOf } from '../../test/fixtures'
import { CharacterForm } from '../CharacterForm'

// Acessibilidade da ficha (P06 da onda 1): um teste de regressão por bug.

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
