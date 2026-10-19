import { fireEvent, screen, within } from '@testing-library/react-native'
import type { ListItem } from '@tms/sheet-core'
import { example, modelOf } from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'

// Etapa 18: o editor de `list` (DS: Repeater / ListEditor). O esquema do
// item vem do template; o mesmo editor serve a Disciplinas, ataques do D&D,
// armas do CoC e às listas do Fate.

const vtm = modelOf('vtm-v20')

async function helenaInEvolve() {
  const helena = example('helena').sheet
  const live = await renderLive(
    { model: vtm, sheet: helena, mode: 'evolve' },
    fakeServer(vtm, helena).post
  )
  fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
  const disciplines = () =>
    live.store().getState().draftEvents()[0]?.to as ListItem[] | undefined
  return { ...live, disciplines }
}

describe('ListEditor', () => {
  it('adicionar pelo catálogo, com busca sem acento; o que já está na ficha não repete', async () => {
    const { disciplines } = await helenaInEvolve()
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    fireEvent.changeText(screen.getByLabelText('Buscar Disciplina'), 'auspi')
    expect(
      screen.getByRole('button', { name: 'Auspícios, já na ficha' })
    ).toBeDisabled()
    fireEvent.changeText(screen.getByLabelText('Buscar Disciplina'), 'fortit')
    fireEvent.press(screen.getByRole('button', { name: 'Fortitude' }))
    expect(disciplines()?.at(-1)).toEqual({
      id: 'i4',
      name: 'Fortitude',
      value: 1,
    })
  })

  it('adicionar por nome livre (fora do catálogo)', async () => {
    const { disciplines } = await helenaInEvolve()
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    fireEvent.changeText(
      screen.getByLabelText('Buscar Disciplina'),
      '  Obtenebração antiga '
    )
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Obtenebração antiga”' })
    )
    expect(disciplines()?.at(-1)?.name).toBe('Obtenebração antiga')
  })

  it('o item: valor, especialização e notas, num lote só ao salvar', async () => {
    const { disciplines } = await helenaInEvolve()
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Taumaturgia, 3 de 5, especialização Trilha do Sangue',
      })
    )
    fireEvent(
      screen.getByRole('adjustable', { name: 'Taumaturgia, valor' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    fireEvent.changeText(
      screen.getByLabelText('Especialização'),
      'Trilha da Chama'
    )
    fireEvent.changeText(screen.getByLabelText('Notas do jogador'), ' ')
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(disciplines()?.[0]).toEqual({
      id: 'd1',
      name: 'Taumaturgia',
      value: 4,
      specialty: 'Trilha da Chama',
    })
    expect(screen.getByText('Editando · 1 alteração')).toBeTruthy()
  })

  it('remover pede confirmação', async () => {
    const { disciplines } = await helenaInEvolve()
    const open = () =>
      fireEvent.press(screen.getByRole('button', { name: 'Auspícios, 2 de 5' }))
    open()
    fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    expect(screen.getByText('Remover Auspícios?')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Remover Auspícios?')).toBeNull()
    expect(disciplines()).toBeUndefined()

    fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    fireEvent.press(screen.getByRole('button', { name: 'Remover' }))
    expect(disciplines()?.map(d => d.name)).toEqual([
      'Taumaturgia',
      'Dominação',
    ])
    expect(
      screen.queryByRole('button', { name: 'Auspícios, 2 de 5' })
    ).toBeNull()
  })

  it('lista vazia: "Nenhum Antecedente" e Adicionar', async () => {
    const nova = { values: { name: 'Nova' }, specialties: {} }
    await renderLive(
      { model: vtm, sheet: nova, mode: 'evolve' },
      fakeServer(vtm, nova).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    expect(screen.getByText('Nenhuma Disciplina')).toBeTruthy()
    expect(screen.getByText('Nenhum Antecedente')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Adicionar Antecedente' })
    ).toBeTruthy()
  })

  it('renomear o item; o campo de nome respeita o limite do validador', async () => {
    const { disciplines } = await helenaInEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Dominação, 1 de 5' }))
    const name = screen.getByLabelText('Nome')
    expect(name.props.maxLength).toBe(80)
    fireEvent.changeText(name, ' Dominação Plena ')
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(disciplines()?.[2]).toEqual({
      id: 'd3',
      name: 'Dominação Plena',
      value: 1,
    })
    expect(
      screen.getByRole('button', { name: 'Dominação Plena, 1 de 5' })
    ).toBeTruthy()
  })
})

describe('outros sistemas, o mesmo editor', () => {
  it('D&D: ataque com meta numérica e de texto', async () => {
    const c = example('lia')
    const model = modelOf(c.system)
    const { store } = await renderLive(
      { model, sheet: c.sheet, mode: 'evolve' },
      fakeServer(model, c.sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: /^Poderes|Combate/ }))
    fireEvent.press(
      screen.getByRole('button', { name: /^Bordão, Ataque 2, Dano/ })
    )
    fireEvent(
      screen.getByRole('adjustable', { name: 'Bordão, Ataque' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    fireEvent.changeText(screen.getByLabelText('Dano'), '1d6 contundente')
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    const attacks = store().getState().draftEvents()[0]?.to as ListItem[]
    expect(attacks[0]).toEqual({
      id: 'a1',
      name: 'Bordão',
      meta: { bonus: 3, damage: '1d6 contundente' },
    })
  })

  it('Fate: consequências (lista fixa) e aspectos (texto)', async () => {
    const c = example('dandara')
    const model = modelOf(c.system)
    const { store } = await renderLive(
      { model, sheet: c.sheet, mode: 'evolve' },
      fakeServer(model, c.sheet).post
    )
    const consequences = within(screen.getByTestId('editor-consequences'))
    // Lista fixa: sem Adicionar nem Remover
    expect(
      consequences.queryByRole('button', { name: /^Adicionar/ })
    ).toBeNull()
    fireEvent.press(consequences.getByRole('button', { name: /^Moderada/ }))
    expect(screen.queryByRole('button', { name: 'Remover' })).toBeNull()
    fireEvent.changeText(
      screen.getByLabelText('Consequência'),
      'Ombro deslocado'
    )
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    const fixed = store().getState().draftEvents()[0]?.to as ListItem[]
    expect(fixed.find(i => i.id === 'moderate')).toEqual({
      id: 'moderate',
      text: 'Ombro deslocado',
    })

    const aspects = within(screen.getByTestId('editor-aspects'))
    fireEvent.press(aspects.getByRole('button', { name: 'Adicionar Aspecto' }))
    fireEvent.changeText(screen.getByLabelText('Nome'), 'Café forte')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Café forte”' })
    )
    const events = store().getState().draftEvents()
    const added = events.find(e => e.path === 'values.aspects')
      ?.to as ListItem[]
    expect(added.at(-1)).toEqual({ id: 'i4', text: 'Café forte' })
  })
})
