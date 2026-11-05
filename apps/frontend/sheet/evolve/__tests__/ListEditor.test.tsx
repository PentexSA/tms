import { fireEvent, screen, within } from '@testing-library/react-native'
import { compileTemplate, type ListItem } from '@tms/sheet-core'
import {
  example,
  GIFTS,
  modelOf,
  templateWithIdentity,
} from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'
import { textInput } from '../../../test/queries'

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

  it('o item: valor na linha, especialização e notas na folha, num lote só ao salvar', async () => {
    const { disciplines } = await helenaInEvolve()
    // R-25: o valor sobe na própria linha, sem abrir a folha
    fireEvent(
      screen.getByRole('adjustable', { name: 'Taumaturgia' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    expect(screen.queryByTestId('item-sheet-disciplines')).toBeNull()
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Taumaturgia, 4 de 5, especialização Trilha do Sangue',
      })
    )
    // A folha fica com nome, especialização e notas: o Valor saiu dela
    expect(screen.queryByRole('adjustable', { name: /valor/ })).toBeNull()
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

  it('R-25: o "−" desce na linha; o item fica com 0, e tirar é pela folha', async () => {
    const { disciplines } = await helenaInEvolve()
    const auspex = () => screen.getByRole('adjustable', { name: 'Auspícios' })
    for (const _ of [1, 2])
      fireEvent(auspex(), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      })
    expect(disciplines()?.find(d => d.name === 'Auspícios')?.value).toBe(0)
    expect(
      screen.getByRole('button', { name: 'Auspícios, 0 de 5' })
    ).toBeTruthy()
    // No mínimo, o "−" não desce mais
    fireEvent(auspex(), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    })
    expect(disciplines()?.find(d => d.name === 'Auspícios')?.value).toBe(0)
  })

  it('R-25: a linha não aninha botões, e o nome abre a folha com a dica', async () => {
    await helenaInEvolve()
    const row = within(screen.getByTestId('item-disciplines-d2'))
    const name = row.getByRole('button', { name: 'Auspícios, 2 de 5' })
    expect(name.props.accessibilityHint).toBe(
      'Abre o item: nome, especialização e notas'
    )
    expect(within(name).queryByRole('adjustable')).toBeNull()
    expect(row.getByRole('adjustable', { name: 'Auspícios' })).toBeTruthy()
  })

  it('R-25: lista sem valor (Qualidades) continua com a linha que abre a folha, sem −/+', async () => {
    const helena = example('helena').sheet
    const sheet = {
      ...helena,
      values: {
        ...helena.values,
        merits: [{ id: 'm1', name: 'Ambidestro', meta: { cost: 1 } }],
      },
    }
    await renderLive(
      { model: vtm, sheet, mode: 'evolve' },
      fakeServer(vtm, sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const merits = within(screen.getByTestId('editor-merits'))
    expect(merits.queryByRole('adjustable')).toBeNull()
    expect(merits.getByRole('button', { name: /^Ambidestro/ })).toBeTruthy()
  })

  it('R-25: ficha ativa, dona: o −/+ da linha fica desabilitado com "Peça ao narrador."', async () => {
    const helena = example('helena').sheet
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'evolve',
        lifecycle: { status: 'active', locked: false, member: true },
      },
      fakeServer(vtm, helena).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const disciplines = within(screen.getByTestId('editor-disciplines'))
    expect(
      disciplines.getByRole('adjustable', { name: 'Auspícios' }).props[
        'aria-disabled'
      ]
    ).toBe(true)
    expect(disciplines.getByText('Peça ao narrador.')).toBeTruthy()
    // O nome continua abrindo a folha (nome e notas seguem editáveis)
    fireEvent.press(
      disciplines.getByRole('button', { name: 'Auspícios, 2 de 5' })
    )
    expect(screen.getByTestId('item-sheet-disciplines')).toBeTruthy()
  })

  it('nome repetido sem catálogo: "Já há", o Enter explica e "Adicionar outro" repete', async () => {
    const helena = example('helena').sheet
    const sheet = {
      ...helena,
      values: {
        ...helena.values,
        merits: [{ id: 'm1', name: 'Ambidestro', meta: { cost: 1 } }],
      },
    }
    const { store } = await renderLive(
      { model: vtm, sheet, mode: 'evolve' },
      fakeServer(vtm, sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    fireEvent.changeText(textInput('Nome'), 'ambidestro')
    expect(screen.getByTestId('add-repeated')).toHaveTextContent(
      'Já há “ambidestro” na ficha.'
    )
    // O Enter não repete sem querer
    fireEvent(textInput('Nome'), 'submitEditing', {
      nativeEvent: { text: 'ambidestro' },
    })
    expect(store().getState().draftEvents()).toEqual([])
    expect(screen.getByTestId('add-sheet-merits')).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar outro “ambidestro”' })
    )
    const merits = store().getState().draftEvents()[0]?.to as ListItem[]
    expect(merits.map(m => m.name)).toEqual(['Ambidestro', 'ambidestro'])
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
    const name = textInput('Nome')
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

describe('T-23: o item nasce com o valor que o editor mostra', () => {
  const flawsOf = (live: { store: () => { getState: () => unknown } }) =>
    (
      live.store().getState() as {
        draftEvents: () => { path: string; to: unknown }[]
      }
    )
      .draftEvents()
      .find(e => e.path === 'values.flaws')?.to as ListItem[] | undefined

  it('Defeito novo grava o Bônus 1 que a folha mostra; a linha diz "Bônus 1"', async () => {
    const live = await helenaInEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Defeito' }))
    fireEvent.changeText(textInput('Nome'), 'Pesadelos')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Pesadelos”' })
    )
    expect(flawsOf(live)?.at(-1)).toEqual({
      id: 'i2',
      name: 'Pesadelos',
      meta: { bonus: 1 },
    })
    const flaws = within(screen.getByTestId('editor-flaws'))
    expect(flaws.getByText('Bônus 1')).toBeTruthy()
    // O meta de texto continua só com o valor; o número ganha o rótulo
    expect(flaws.getByText('Social · Bônus 2')).toBeTruthy()
  })

  it('Defeito gravado sem bônus: abrir e Aplicar grava o 1 que a folha mostra', async () => {
    const helena = example('helena').sheet
    const sheet = {
      ...helena,
      values: { ...helena.values, flaws: [{ id: 'f1', name: 'Inimigo' }] },
    }
    const live = await renderLive(
      { model: vtm, sheet, mode: 'evolve' },
      fakeServer(vtm, sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    fireEvent.press(screen.getByRole('button', { name: 'Inimigo' }))
    expect(
      screen.getByRole('adjustable', { name: 'Inimigo, Bônus' })
    ).toHaveAccessibilityValue({ now: 1 })
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(flawsOf(live)).toEqual([
      { id: 'f1', name: 'Inimigo', meta: { bonus: 1 } },
    ])
  })

  it('D&D: meta numérico sem mínimo (Ataque) não ganha valor inventado', async () => {
    const c = example('lia')
    const model = modelOf(c.system)
    const { store } = await renderLive(
      { model, sheet: c.sheet, mode: 'evolve' },
      fakeServer(model, c.sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: /^Poderes|Combate/ }))
    // A linha do ataque mostra o rótulo e o sinal do template
    expect(
      within(screen.getByTestId('editor-attacks')).getByText(
        'Ataque +2 · 1d6 − 1 contundente'
      )
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Ataque' }))
    fireEvent.changeText(textInput('Nome'), 'Adaga')
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar “Adaga”' }))
    const attacks = store()
      .getState()
      .draftEvents()
      .find(e => e.path === 'values.attacks')?.to as ListItem[]
    expect(attacks.at(-1)).toEqual({ id: 'i3', name: 'Adaga' })
  })
})

describe('T-62: Enter e "✓" adicionam', () => {
  const eventFor = (
    live: Awaited<ReturnType<typeof helenaInEvolve>>,
    field: string
  ) =>
    live
      .store()
      .getState()
      .draftEvents()
      .find(e => e.path === `values.${field}`)?.to as ListItem[] | undefined
  // Como no app: o Enter traz o texto do campo
  const enter = (label: string, text?: string) =>
    fireEvent(textInput(label), 'submitEditing', {
      nativeEvent: { text: text ?? textInput(label).props.value },
    })

  it('lista sem catálogo (Qualidade): o Enter adiciona o texto livre', async () => {
    const live = await helenaInEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    const name = textInput('Nome')
    expect(name.props.returnKeyType).toBe('done')
    expect(name.props.submitBehavior).toBe('submit')
    fireEvent.changeText(name, ' Ambidestro ')
    enter('Nome')
    expect(eventFor(live, 'merits')?.at(-1)).toEqual({
      id: 'i2',
      name: 'Ambidestro',
      meta: { cost: 1 },
    })
    // Entrou: a folha fechou
    expect(screen.queryByTestId('add-sheet-merits')).toBeNull()
  })

  // Integração da onda 2, no AVD: o "✓" chegou antes do último
  // onChangeText, e a Qualidade entrou como "Ambi"
  it('o Enter usa o texto que chega com ele, não o do último onChangeText', async () => {
    const live = await helenaInEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    fireEvent.changeText(textInput('Nome'), 'Ambi')
    enter('Nome', 'Ambidestro')
    expect(eventFor(live, 'merits')?.at(-1)).toEqual({
      id: 'i2',
      name: 'Ambidestro',
      meta: { cost: 1 },
    })
  })

  it('nome exato do catálogo adiciona a Disciplina; sugestão parcial não vira texto livre', async () => {
    const live = await helenaInEvolve()
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    fireEvent.changeText(screen.getByLabelText('Buscar Disciplina'), 'fort')
    enter('Buscar Disciplina')
    expect(eventFor(live, 'disciplines')).toBeUndefined()
    // Com sugestões à vista, o campo diz o que tocar
    const sheet = within(screen.getByTestId('add-sheet-disciplines'))
    expect(sheet.getByRole('alert')).toHaveTextContent(
      'Toque numa sugestão, ou em “Adicionar “fort”” para usar o nome como está.'
    )

    // O que já está na ficha não entra de novo pelo Enter
    fireEvent.changeText(
      screen.getByLabelText('Buscar Disciplina'),
      'auspicios'
    )
    expect(sheet.queryByRole('alert')).toBeNull()
    enter('Buscar Disciplina')
    expect(eventFor(live, 'disciplines')).toBeUndefined()
    expect(sheet.getByRole('alert')).toHaveTextContent(
      'Auspícios já está na ficha.'
    )

    fireEvent.changeText(
      screen.getByLabelText('Buscar Disciplina'),
      'fortitude'
    )
    enter('Buscar Disciplina')
    expect(eventFor(live, 'disciplines')?.at(-1)).toEqual({
      id: 'i4',
      name: 'Fortitude',
      value: 1,
    })
  })

  it('campo vazio: o Enter não faz nada', async () => {
    const live = await helenaInEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Qualidade' }))
    enter('Nome')
    expect(eventFor(live, 'merits')).toBeUndefined()
    expect(screen.getByTestId('add-sheet-merits')).toBeTruthy()
  })
})

describe('R-26 e T-24: o que a identidade recomenda', () => {
  const w20 = compileTemplate(templateWithIdentity('wta-w20'))
  const v20 = compileTemplate(templateWithIdentity('vtm-v20'))
  const render = async (
    model: typeof w20,
    values: Record<string, unknown>,
    tab = 'Vantagens'
  ) => {
    const sheet = { values: { name: 'Nova', ...values }, specialties: {} }
    const live = await renderLive(
      { model, sheet, mode: 'evolve' },
      fakeServer(model, sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: tab }))
    return live
  }
  const gifts = (store: () => { getState(): { draftEvents(): unknown[] } }) =>
    (store().getState().draftEvents()[0] as { to?: ListItem[] } | undefined)?.to

  it('Lupino Ahroun Fianna: os três blocos com a fonte, os selos e o Posto; o resto pela busca', async () => {
    await render(w20, { breed: 'lupino', auspice: 'ahroun', tribe: 'fianna' })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Dom' }))
    const sheet = within(screen.getByTestId('add-sheet-gifts'))
    const titles = sheet
      .getAllByRole('header')
      .map(h => h.props.children)
      .filter(t => t !== 'Adicionar Dom')
    expect(titles).toEqual([
      'Da Raça · Lupino',
      'Do Augúrio · Ahroun',
      'Da Tribo · Fianna',
      'Outras',
    ])
    // O nome em duas fontes aparece uma vez, com os dois selos
    expect(
      sheet.getByRole('button', {
        name: `${GIFTS.breed}, Posto 1, da Raça, da Tribo`,
      })
    ).toBeTruthy()
    // Catálogo pequeno no teste: "Outras" mostra o resto (o limite é 40)
    expect(
      within(screen.getByTestId('add-block-others')).getByRole('button', {
        name: GIFTS.other,
      })
    ).toBeTruthy()
  })

  it('catálogo grande: sem busca, só as recomendadas, e o resto pela busca', async () => {
    const t = templateWithIdentity('wta-w20')
    const gifts = (t.fields as Record<string, Record<string, unknown>>).gifts
    if (gifts)
      gifts.catalog = [
        ...(gifts.catalog as string[]),
        ...Array.from({ length: 40 }, (_, i) => `Dom Fictício ${i + 1}`),
      ]
    await render(compileTemplate(t), { breed: 'lupino' })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Dom' }))
    const sheet = within(screen.getByTestId('add-sheet-gifts'))
    expect(screen.queryByTestId('add-block-others')).toBeNull()
    expect(
      sheet.getByText('Busque pelo nome para ver o restante da lista.')
    ).toBeTruthy()
    expect(sheet.queryByRole('button', { name: /^Dom Fictício/ })).toBeNull()
    fireEvent.changeText(screen.getByLabelText('Buscar Dom'), 'fictício 12')
    expect(sheet.getByRole('button', { name: 'Dom Fictício 12' })).toBeTruthy()
  })

  it('a busca acha o Dom de outra fonte e o texto livre continua', async () => {
    const { store } = await render(w20, {
      breed: 'lupino',
      auspice: 'ahroun',
      tribe: 'fianna',
    })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Dom' }))
    fireEvent.changeText(screen.getByLabelText('Buscar Dom'), 'pedra')
    expect(screen.getByRole('button', { name: `${GIFTS.other}` })).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Buscar Dom'), 'Uivo Inventado')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Uivo Inventado”' })
    )
    // O texto livre nasce com o mínimo do Posto (sem entrada no catálogo)
    expect(gifts(store)?.at(-1)).toEqual({
      id: 'i1',
      name: 'Uivo Inventado',
      meta: { rank: 1 },
    })
  })

  it('o nome do catálogo nasce com o Posto do catálogo (catalogDefaults)', async () => {
    const { store } = await render(w20, { breed: 'lupino' })
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar Dom' }))
    fireEvent.changeText(screen.getByLabelText('Buscar Dom'), 'neblina')
    fireEvent.press(
      screen.getByRole('button', { name: `${GIFTS.rank2}, Posto 2` })
    )
    expect(gifts(store)?.at(-1)).toEqual({
      id: 'i1',
      name: GIFTS.rank2,
      meta: { rank: 2 },
    })
  })

  it('sem Clã: lista neutra e a frase de escolher na identidade', async () => {
    await render(v20, {})
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    const sheet = within(screen.getByTestId('add-sheet-disciplines'))
    expect(
      sheet.getByText('Escolha Clã na identidade para ver as recomendações.')
    ).toBeTruthy()
    expect(sheet.queryByRole('header', { name: 'Do clã' })).toBeNull()
    expect(sheet.queryByRole('button', { name: /do clã/ })).toBeNull()
  })

  it('Caitiff (sem entrada no mapa): nenhum selo e nenhum "fora"', async () => {
    await render(v20, {
      clan: 'caitiff',
      disciplines: [{ id: 'd1', name: 'Dominação', value: 1 }],
    })
    expect(screen.queryByTestId('identity-disciplines-d1')).toBeNull()
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Disciplina' })
    )
    const sheet = within(screen.getByTestId('add-sheet-disciplines'))
    expect(sheet.queryByRole('header', { name: 'Do clã' })).toBeNull()
    expect(sheet.queryByText(/Escolha/)).toBeNull()
  })

  it('ficha ativa (não é criação): o selo fica, o "fora" e o Posto não aparecem', async () => {
    const sheet = {
      values: {
        name: 'Ativa',
        breed: 'lupino',
        gifts: [{ id: 'g1', name: GIFTS.other, meta: { rank: 3 } }],
      },
      specialties: {},
    }
    await renderLive(
      {
        model: w20,
        sheet,
        mode: 'evolve',
        lifecycle: { status: 'active', locked: false, member: true },
      },
      fakeServer(w20, sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    expect(screen.queryByTestId('identity-gifts-g1')).toBeNull()
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
      screen.getByRole('button', { name: /^Bordão, Ataque mais 2, Dano/ })
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

  it('Mago: a Ressonância tem três linhas fixas, com pontos e descritor', async () => {
    const c = example('otto')
    const model = modelOf(c.system)
    const { store } = await renderLive(
      { model, sheet: c.sheet, mode: 'evolve' },
      fakeServer(model, c.sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const resonance = within(screen.getByTestId('editor-resonance'))
    expect(resonance.queryByRole('button', { name: /^Adicionar/ })).toBeNull()
    expect(
      resonance.getByRole('button', { name: 'Dinâmica, Elétrica, 2 de 5' })
    ).toBeTruthy()
    // A linha sem pontos mostra os pips vazios, como na ficha de papel
    expect(
      resonance.getByRole('button', { name: 'Entrópica, 0 de 5' })
    ).toBeTruthy()
    // Os pontos sobem na linha; o descritor muda na folha
    fireEvent(
      resonance.getByRole('adjustable', { name: 'Entrópica' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    fireEvent.press(resonance.getByRole('button', { name: /^Entrópica/ }))
    fireEvent.changeText(screen.getByLabelText('Descritor'), 'Fria')
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    const items = store().getState().draftEvents()[0]?.to as ListItem[]
    expect(items).toEqual([
      { id: 'dynamic', text: 'Elétrica', value: 2 },
      { id: 'entropic', text: 'Fria', value: 1 },
      { id: 'static', text: 'Metódica', value: 1 },
    ])
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
    fireEvent.changeText(textInput('Nome'), 'Café forte')
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar “Café forte”' })
    )
    const events = store().getState().draftEvents()
    const added = events.find(e => e.path === 'values.aspects')
      ?.to as ListItem[]
    expect(added.at(-1)).toEqual({ id: 'i4', text: 'Café forte' })
  })
})
