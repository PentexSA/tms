import { fireEvent, screen, within } from '@testing-library/react-native'
import type { SheetData } from '@tms/sheet-core'
import { Platform } from 'react-native'
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

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => setOS(realOS))

const keyDown = (key: string) => ({
  nativeEvent: { key, repeat: false },
  preventDefault: jest.fn(),
})

describe('Seletor de modo no web: setas só movem o foco (T-35)', () => {
  it('a seta não troca o modo; o Espaço troca', async () => {
    setOS('web')
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    const play = screen.getByRole('radio', { name: 'Jogo' })
    const edit = screen.getByRole('radio', { name: 'Editar' })
    expect(play.props.tabIndex).toBe(0)
    expect(edit.props.tabIndex).toBe(-1)
    fireEvent(play, 'keyDown', keyDown('ArrowRight'))
    expect(screen.getByRole('radio', { name: 'Editar' })).not.toBeChecked()
    expect(screen.queryByText(/^Editando/)).toBeNull()
    fireEvent(edit, 'keyDown', keyDown(' '))
    expect(screen.getByRole('radio', { name: 'Editar' })).toBeChecked()
    expect(screen.getByText('Editando · 0 alterações')).toBeTruthy()
  })
})

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
