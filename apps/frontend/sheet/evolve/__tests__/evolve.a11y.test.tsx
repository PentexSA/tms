import { fireEvent, screen, within } from '@testing-library/react-native'
import type { SheetData } from '@tms/sheet-core'
import { modelOf } from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'

// Acessibilidade do modo Editar (P06 da onda 1): um teste de regressão por bug.

const model = modelOf('vtm-v20')
const nova: SheetData = {
  values: { name: 'Nova', clan: 'tremere', strength: 2 },
  specialties: {},
}

const enterEvolve = () =>
  fireEvent.press(screen.getByRole('radio', { name: 'Editar' }))

describe('Editar: a folha da escolha não repete o título (T-09)', () => {
  it('o título da folha já é o nome do campo', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Clã: Tremere' }))
    const group = screen.getByLabelText('Clã')
    expect(within(group).getByRole('radio', { name: 'Brujah' })).toBeTruthy()
    // Sem o título do Choice: o "Clã" visível é o da folha, fora do grupo
    expect(
      group.parent ? within(group.parent).queryByText('Clã') : null
    ).toBeNull()
  })
})
