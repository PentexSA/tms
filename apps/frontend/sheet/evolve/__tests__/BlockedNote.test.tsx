import { render, screen } from '@testing-library/react-native'
import { sheetFor } from '../../../test/fixtures'
import { SheetProvider } from '../../context'
import { LifecycleContext } from '../../policy'
import { createSheetStore } from '../../store/sheetStore'
import { type XpShortcut, XpShortcutContext } from '../../xp/XpShortcut'
import { BlockedNote } from '../BlockedNote'

// U-01: a nota leva ao pedido só quando ela é da evolução e tem um alvo.

const { model, sheet } = sheetFor('helena', ['owner'])
const shortcut: XpShortcut = { offers: () => true, open: jest.fn() }

const renderNote = (to: Parameters<typeof BlockedNote>[0]['to']) => {
  const store = createSheetStore({
    characterId: 'c1',
    model,
    sheet,
    sheetVersion: 1,
    roles: ['owner'],
    mode: 'evolve',
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-000000000001',
  })
  render(
    <SheetProvider store={store}>
      <LifecycleContext.Provider
        value={{ status: 'active', locked: false, member: true }}
      >
        <XpShortcutContext.Provider value={shortcut}>
          <BlockedNote text="Peça ao narrador." to={to} subject="Força" />
        </XpShortcutContext.Provider>
      </LifecycleContext.Provider>
    </SheetProvider>
  )
}

describe('BlockedNote', () => {
  it('com alvo (uma linha de evolução), o atalho', () => {
    renderNote({ target: { field: 'strength' } })
    expect(
      screen.getByRole('button', { name: 'Solicitar evolução de Força' })
    ).toBeTruthy()
  })

  it('sem alvo (a nota de uma linha de jogo, como o atual do recurso), só a frase', () => {
    renderNote(null)
    expect(screen.getByText('Peça ao narrador.')).toBeTruthy()
    expect(screen.queryByTestId('xp-shortcut')).toBeNull()
  })
})
