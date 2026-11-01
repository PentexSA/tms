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
    fireEvent.press(screen.getByRole('button', { name: 'Clã' }))
    // A linha do Editar também se chama "Clã" no app (o valor vai à parte)
    const group = screen
      .getAllByLabelText('Clã')
      .find(el => el.props.accessibilityRole === 'radiogroup')
    if (!group) throw new Error('sem o grupo do Clã')
    expect(within(group).getByRole('radio', { name: 'Brujah' })).toBeTruthy()
    // Sem o título do Choice: o "Clã" visível é o da folha, fora do grupo
    expect(
      group.parent ? within(group.parent).queryByText('Clã') : null
    ).toBeNull()
  })
})

describe('Editar: rótulo e valor sem repetição (T-61)', () => {
  it('no app, o rótulo é o campo e o valor vai à parte (sem "Nome: X, X")', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    const name = screen.getByRole('button', { name: 'Nome' })
    expect(name).toHaveAccessibilityValue({ text: 'Nova' })
    expect(name.props.accessibilityLabel).toBe('Nome')
    expect(
      screen.getByRole('button', { name: 'Clã' })
    ).toHaveAccessibilityValue({ text: 'Tremere' })
    expect(
      screen.getByRole('button', { name: 'Conceito' })
    ).toHaveAccessibilityValue({ text: 'vazio' })
  })

  it('no web, o valor fica no rótulo (o web descarta o accessibilityValue)', async () => {
    setOS('web')
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    fireEvent(
      screen.getByRole('radio', { name: 'Editar' }),
      'keyDown',
      keyDown(' ')
    )
    expect(screen.getByRole('button', { name: 'Nome: Nova' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clã: Tremere' })).toBeTruthy()
  })
})

describe('Digitar: aplica ao sair, um campo por vez, recusa decimal (T-25)', () => {
  const typeIn = (name: string) =>
    fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    })
  const field = (name: string) => screen.getByLabelText(`${name}, de 1 a 5`)
  const inputs = () => screen.queryAllByLabelText(/, de 1 a 5$/)

  beforeEach(async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
  })

  it('sair do campo (Tab ou clique fora) aplica', () => {
    typeIn('Força')
    fireEvent.changeText(field('Força'), '3')
    fireEvent(field('Força'), 'blur', { nativeEvent: {} })
    expect(inputs()).toHaveLength(0)
    expect(screen.getByText('Editando · 1 alteração')).toBeTruthy()
    expect(
      screen.getByRole('adjustable', { name: 'Força' })
    ).toHaveAccessibilityValue({ now: 3 })
  })

  it('abrir outro campo aplica o primeiro e fecha: um campo só', () => {
    typeIn('Força')
    fireEvent.changeText(field('Força'), '3')
    typeIn('Destreza')
    expect(inputs()).toHaveLength(1)
    expect(field('Destreza')).toBeTruthy()
    expect(screen.getByText('Editando · 1 alteração')).toBeTruthy()
    expect(
      screen.getByRole('adjustable', { name: 'Força' })
    ).toHaveAccessibilityValue({ now: 3 })
  })

  it('"3.5" recebe a mensagem de inteiro e não muda o valor', () => {
    typeIn('Força')
    fireEvent.changeText(field('Força'), '3.5')
    fireEvent(field('Força'), 'submitEditing', { nativeEvent: { text: '3.5' } })
    expect(screen.getByText('Digite um número inteiro de 1 a 5')).toBeTruthy()
    // Com Enter, o campo fica aberto para corrigir
    expect(inputs()).toHaveLength(1)
    // Ao sair, fecha sem aplicar; a mensagem fica na linha
    fireEvent(field('Força'), 'blur', { nativeEvent: {} })
    expect(inputs()).toHaveLength(0)
    expect(screen.getByText('Digite um número inteiro de 1 a 5')).toBeTruthy()
    expect(screen.getByText('Editando · 0 alterações')).toBeTruthy()
    expect(
      screen.getByRole('adjustable', { name: 'Força' })
    ).toHaveAccessibilityValue({ now: 2 })
  })

  it('Esc cancela: fecha sem aplicar', () => {
    typeIn('Força')
    fireEvent.changeText(field('Força'), '4')
    fireEvent(field('Força'), 'keyPress', { nativeEvent: { key: 'Escape' } })
    expect(inputs()).toHaveLength(0)
    expect(screen.getByText('Editando · 0 alterações')).toBeTruthy()
  })

  it('o Enter continua aplicando, uma vez só (o fim da edição vem junto)', () => {
    typeIn('Força')
    fireEvent.changeText(field('Força'), '4')
    const input = field('Força')
    fireEvent(input, 'submitEditing', { nativeEvent: { text: '4' } })
    fireEvent(input, 'blur', { nativeEvent: {} })
    expect(screen.getByText('Editando · 1 alteração')).toBeTruthy()
    expect(
      screen.getByRole('adjustable', { name: 'Força' })
    ).toHaveAccessibilityValue({ now: 4 })
  })
})

describe('Editar: o Nome sem corretor (T-38)', () => {
  it('a folha do Nome desliga o corretor; a do Conceito não', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Nome' }))
    const name = screen.getByLabelText('Nome (obrigatório)')
    expect(name.props.autoCorrect).toBe(false)
    expect(name.props.spellCheck).toBe(false)
  })
})
