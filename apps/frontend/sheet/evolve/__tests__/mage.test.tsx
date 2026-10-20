import {
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import { example, modelOf } from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'

// v1, Etapa 5: o teto não destrutivo (Esferas ≤ Arete), o selo da afinidade
// e as rotinas (lista sem valor) no Editar do Mago. Nada aqui é código do
// Mago: é o `cap`, o `badge` de seção e o `list` do contrato.

const model = modelOf('mta-m20')
// Otto: Arete 2, Forças 3 (1 inativo), Matéria 2, afinidade Forças
const otto = () => example('otto').sheet

const step = (name: string, actionName: 'increment' | 'decrement') =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
    nativeEvent: { actionName },
  })

async function evolveSpheres() {
  const server = fakeServer(model, otto())
  await renderLive({ model, sheet: otto() }, server.post)
  fireEvent.press(screen.getByRole('radio', { name: 'Editar' }))
  fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
  return server
}

describe('Esferas acima do Arete', () => {
  it('a linha mostra o teto, e o que passa dele fica inativo', async () => {
    await evolveSpheres()
    expect(screen.getByTestId('cap-forces')).toHaveTextContent(
      '1 inativo, máx. pelo Arete 2'
    )
    expect(screen.getByTestId('cap-matter')).toHaveTextContent(
      'máx. pelo Arete 2'
    )
    // O Stepper passa do teto até o máximo do campo, e o leitor ouve o porquê
    step('Matéria', 'increment')
    expect(screen.getByTestId('cap-matter')).toHaveTextContent(
      '1 inativo, máx. pelo Arete 2'
    )
    expect(screen.getByRole('adjustable', { name: 'Matéria' })).toHaveProp(
      'aria-valuetext',
      '3 de 5, 1 inativo, máx. pelo Arete 2'
    )
  })

  it('baixar o Arete: o resumo avisa quem fica inativo, e nenhuma Esfera muda', async () => {
    const server = await evolveSpheres()
    step('Arete', 'decrement')
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    const inactive = within(screen.getByTestId('evolve-inactive'))
    expect(
      inactive.getByLabelText('Forças, 2 inativo, máx. pelo Arete 1')
    ).toBeTruthy()
    expect(
      inactive.getByLabelText('Matéria, 1 inativo, máx. pelo Arete 1')
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(server.post).toHaveBeenCalledTimes(1))
    expect(server.sent[0]?.events.map(e => e.path)).toEqual(['values.arete'])
    expect(server.current().values.forces).toBe(3)
  })

  it('subir o Arete: o que estava inativo volta a valer', async () => {
    await evolveSpheres()
    step('Arete', 'increment')
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    expect(
      within(screen.getByTestId('evolve-inactive')).getByLabelText(
        'Forças, volta a valer'
      )
    ).toBeTruthy()
  })
})

describe('afinidade', () => {
  it('o selo marca a Esfera de afinidade e acompanha a escolha', async () => {
    await evolveSpheres()
    expect(screen.getByTestId('badge-forces')).toHaveTextContent('◆ Afinidade')
    expect(screen.queryByTestId('badge-matter')).toBeNull()

    fireEvent.press(
      screen.getByRole('button', { name: /^Esfera de afinidade/ })
    )
    fireEvent.press(screen.getByRole('radio', { name: 'Matéria' }))
    await waitFor(() => expect(screen.getByTestId('badge-matter')).toBeTruthy())
    expect(screen.queryByTestId('badge-forces')).toBeNull()
  })
})

describe('rotinas (lista sem valor)', () => {
  it('adiciona pelo nome, sem stepper, e o lote leva só id e nome', async () => {
    const server = await evolveSpheres()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Rotina' }))
    fireEvent.changeText(screen.getByLabelText('Nome'), 'Escudo de estática')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Escudo de estática”' })
    )
    expect(screen.queryByRole('adjustable', { name: /Escudo/ })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(server.post).toHaveBeenCalledTimes(1))
    expect(server.current().values.rotes).toEqual([
      ...(otto().values.rotes as unknown[]),
      { id: 'i3', name: 'Escudo de estática' },
    ])
  })
})
