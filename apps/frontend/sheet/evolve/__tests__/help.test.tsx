import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { compileTemplate, type SheetData } from '@tms/sheet-core'
import { ThemeProvider } from '@tms/ui'
import { StyleSheet } from 'react-native'
import { modelOf, templateJson } from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'
import { SuggestionChips } from '../../editors/Suggestions'
import { blockHelp } from '../../layouts/groupHelp'
import { nameHelp } from '../help'

// R-19 (P10-D): o "?" da ajuda do template nas linhas do Editar (e da
// criação, que usa os mesmos editores). Só nesses modos: em Jogo e Leitura,
// as folhas de detalhe já mostram a frase (pergunta 8 do plano).

const model = modelOf('vtm-v20')
const nova: SheetData = {
  values: { name: 'Nova', clan: 'tremere', strength: 2 },
  specialties: {},
}
const helpOf = (id: string) => model.fields.get(id)?.def.help ?? ''
const editing = () =>
  renderLive(
    { model, sheet: nova, mode: 'evolve' },
    fakeServer(model, nova).post
  )
const helpIn = (testID: string, name: string) =>
  within(screen.getByTestId(testID)).getByRole('button', {
    name: `Ajuda: ${name}`,
  })

describe('Editar: o "?" da ajuda do template (R-19)', () => {
  // IW-06: o Talento e a Virtude se chamam "Consciência" e têm frases
  // diferentes no template; antes, a linha do Editar não mostrava nenhuma.
  it('o Talento e a Virtude Consciência têm um "?" cada, com a frase de cada um', async () => {
    await editing()
    const talent = helpOf('awareness')
    const virtue = helpOf('conscience')
    expect(talent).not.toBe('')
    expect(talent).not.toBe(virtue)
    expect(
      helpIn('editor-awareness', 'Consciência').props.accessibilityState
    ).toMatchObject({ expanded: false })
    expect(screen.queryByText(talent)).toBeNull()
    fireEvent.press(helpIn('editor-awareness', 'Consciência'))
    expect(screen.getByText(talent)).toBeTruthy()
    expect(
      helpIn('editor-awareness', 'Consciência').props.accessibilityState
    ).toMatchObject({ expanded: true })
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    fireEvent.press(helpIn('editor-conscience', 'Consciência'))
    expect(screen.getByText(virtue)).toBeTruthy()
  })

  it('o "?" fica fora do controle da linha, e o Stepper continua com o nome de hoje', async () => {
    await editing()
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const humanity = screen.getByRole('adjustable', { name: 'Humanidade' })
    expect(within(humanity).queryByRole('button')).toBeNull()
    expect(helpIn('editor-humanity', 'Humanidade')).toBeTruthy()
  })

  it('campo sem frase não mostra "?"', async () => {
    await editing()
    expect(
      within(screen.getByTestId('editor-strength')).queryByRole('button', {
        name: /^Ajuda:/,
      })
    ).toBeNull()
  })

  it('a linha de texto: o "?" é irmão do botão da linha, que não muda', async () => {
    await editing()
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const row = screen.getByTestId('editor-weakness')
    expect(row.props.accessibilityHint).toBe('Abre o editor de texto')
    expect(within(row).queryByRole('button', { name: /^Ajuda:/ })).toBeNull()
    fireEvent.press(
      screen.getByRole('button', { name: 'Ajuda: Fraqueza do clã' })
    )
    expect(screen.getByText(helpOf('weakness'))).toBeTruthy()
  })

  it('a lista com frase no campo: "?" no cabeçalho do bloco', async () => {
    await editing()
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const merits = model.fields.get('merits')?.def
    expect(merits?.help).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: `Ajuda: ${merits?.label}` }).length
    ).toBeGreaterThan(0)
  })

  it('em Jogo, nenhum "?"', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    expect(screen.queryAllByRole('button', { name: /^Ajuda:/ })).toEqual([])
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    expect(screen.queryAllByRole('button', { name: /^Ajuda:/ })).toEqual([])
  })
})

// Frases nos nós novos (grupo e opção), num template montado no teste: o
// mecanismo não depende do conteúdo do template do produto.
type Json = Record<string, unknown>
function withHelp() {
  const t = templateJson('vtm-v20')
  const sections = t.sections as Json[]
  const attributes = sections.find(s => s.id === 'attributes')
  const [physical, social] = (attributes?.groups ?? []) as Json[]
  if (physical) physical.help = 'Frase do grupo, do teste.'
  // Sem frase, nada de "?" (o template do produto já tem as frases)
  if (social) delete social.help
  const clan = (t.fields as Record<string, Json>).clan
  const options = (clan?.options ?? []) as Json[]
  const brujah = options.find(o => o.id === 'brujah')
  if (brujah) brujah.help = 'Frase da opção, do teste.'
  const tremere = options.find(o => o.id === 'tremere')
  if (tremere) delete tremere.help
  return compileTemplate(t)
}

describe('Editar: o "?" no grupo e na opção (R-19)', () => {
  it('o grupo com frase tem "?" no título ou no topo da aba', async () => {
    const m = withHelp()
    await renderLive(
      { model: m, sheet: nova, mode: 'evolve' },
      fakeServer(m, nova).post
    )
    const help = screen.getByTestId('group-help-physical')
    expect(help.props.accessibilityLabel).toBe('Ajuda: Físicos')
    fireEvent.press(help)
    expect(screen.getByText('Frase do grupo, do teste.')).toBeTruthy()
    expect(screen.queryByTestId('group-help-social')).toBeNull()
  })

  it('a folha do Clã: "?" na opção com frase, fora do rádio', async () => {
    const m = withHelp()
    await renderLive(
      { model: m, sheet: nova, mode: 'evolve' },
      fakeServer(m, nova).post
    )
    fireEvent.press(screen.getByRole('button', { name: 'Clã' }))
    const radio = screen.getByRole('radio', { name: 'Brujah' })
    expect(within(radio).queryByRole('button')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Ajuda: Brujah' }))
    expect(screen.getByText('Frase da opção, do teste.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ajuda: Tremere' })).toBeNull()
  })

  it('em Jogo, o grupo não mostra "?"', async () => {
    const m = withHelp()
    await renderLive({ model: m, sheet: nova }, fakeServer(m, nova).post)
    expect(screen.queryByTestId('group-help-physical')).toBeNull()
  })
})

// Revisão (item 6): no bloco que o título nomeia, a frase do grupo e a da
// lista aparecem juntas no mesmo "?", a do grupo primeiro; nenhuma se perde.
describe('blockHelp: as duas frases do bloco', () => {
  it('as duas, na ordem; a repetida sai; nenhuma, sem "?"', () => {
    expect(blockHelp('Qualidades', 'Do grupo.', 'Da lista.')).toEqual({
      subject: 'Qualidades',
      text: 'Do grupo. Da lista.',
    })
    expect(blockHelp('X', 'Igual.', 'Igual.')?.text).toBe('Igual.')
    expect(blockHelp('X', null, 'Da lista.')?.text).toBe('Da lista.')
    expect(blockHelp('X', 'Do grupo.', undefined)?.text).toBe('Do grupo.')
    expect(blockHelp('X', null, null)).toBeNull()
  })
})

function withBlockHelp(system: string, section: string, group: string) {
  const t = templateJson(system)
  const s = (t.sections as Json[]).find(x => x.id === section)
  const g = ((s?.groups ?? []) as Json[]).find(x => x.id === group)
  if (g) g.help = 'Frase do grupo, do teste.'
  return compileTemplate(t)
}

describe('Editar: o bloco com frase do grupo e da lista (R-19)', () => {
  it('título do grupo que nomeia a lista: um "?" com as duas frases', async () => {
    const m = withBlockHelp('vtm-v20', 'merits-flaws', 'merits')
    await renderLive(
      { model: m, sheet: nova, mode: 'evolve' },
      fakeServer(m, nova).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const help = screen.getByTestId('group-help-merits')
    expect(help.props.accessibilityLabel).toBe('Ajuda: Qualidades')
    fireEvent.press(help)
    const list = m.fields.get('merits')?.def.help ?? '-'
    expect(screen.getByText(`Frase do grupo, do teste. ${list}`)).toBeTruthy()
  })

  it('título da seção que nomeia o bloco (echo): a frase do grupo não some', async () => {
    const m = withBlockHelp('mta-m20', 'backgrounds', 'backgrounds')
    const sheet: SheetData = {
      values: { name: 'Nova', tradition: 'verbena' },
      specialties: {},
    }
    await renderLive(
      { model: m, sheet, mode: 'evolve' },
      fakeServer(m, sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    fireEvent.press(screen.getByTestId('group-help-backgrounds'))
    const list = m.fields.get('backgrounds')?.def.help ?? '-'
    expect(screen.getByText(`Frase do grupo, do teste. ${list}`)).toBeTruthy()
  })
})

// Commit 7: a frase por nome do catálogo (catalogHelp) e das sugestões
// (suggestionHelp), no mapa ao lado da lista
describe('Editar: o "?" no catálogo e nas sugestões (R-19)', () => {
  const backgrounds = model.fields.get('backgrounds')?.def as {
    catalogHelp?: Record<string, string>
  }

  it('a opção do catálogo tem "?" à direita, fora do botão da opção', async () => {
    await editing()
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    fireEvent.press(
      screen.getByRole('button', { name: 'Adicionar Antecedente' })
    )
    const sheet = within(screen.getByTestId('add-sheet-backgrounds'))
    const option = sheet.getByRole('button', { name: 'Aliados' })
    expect(within(option).queryByRole('button', { name: /^Ajuda:/ })).toBeNull()
    fireEvent.press(sheet.getByRole('button', { name: 'Ajuda: Aliados' }))
    expect(
      sheet.getByText(backgrounds.catalogHelp?.Aliados ?? '-')
    ).toBeTruthy()
  })

  it('o item já na ficha: a linha sem "?", e a frase no topo da folha', async () => {
    const sheet: SheetData = {
      values: {
        ...nova.values,
        backgrounds: [{ id: 'b1', name: 'Aliados', value: 1 }],
      },
      specialties: {},
    }
    await renderLive(
      { model, sheet, mode: 'evolve' },
      fakeServer(model, sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const list = within(screen.getByTestId('editor-backgrounds'))
    expect(list.queryByRole('button', { name: 'Ajuda: Aliados' })).toBeNull()
    fireEvent.press(list.getByRole('button', { name: /^Aliados/ }))
    expect(screen.getByTestId('item-help')).toHaveTextContent(
      backgrounds.catalogHelp?.Aliados ?? '-'
    )
  })

  it('sugestão com frase tem "?" junto do chip; sem frase, nenhum "?"', () => {
    const pick = jest.fn()
    const { rerender } = render(
      <ThemeProvider>
        <SuggestionChips
          options={['Arquiteto', 'Bon Vivant']}
          value=""
          onPick={pick}
          help={{ Arquiteto: 'Frase do Arquiteto, do teste.' }}
        />
      </ThemeProvider>
    )
    fireEvent.press(screen.getByRole('button', { name: 'Ajuda: Arquiteto' }))
    expect(screen.getByText('Frase do Arquiteto, do teste.')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Ajuda: Bon Vivant' })
    ).toBeNull()
    fireEvent.press(screen.getByText('Bon Vivant'))
    expect(pick).toHaveBeenCalledWith('Bon Vivant')
    rerender(
      <ThemeProvider>
        <SuggestionChips
          options={['Arquiteto', 'Bon Vivant']}
          value=""
          onPick={pick}
        />
      </ThemeProvider>
    )
    expect(screen.queryAllByRole('button', { name: /^Ajuda:/ })).toEqual([])
  })

  it('o nome do item não lê propriedade herdada do mapa', () => {
    expect(nameHelp({ Aliados: 'x' }, 'toString')).toBeNull()
    expect(nameHelp({ Aliados: 'x' }, 'Aliados')).toEqual({
      subject: 'Aliados',
      text: 'x',
    })
  })
})

// Revisão do merge e do commit 7 (itens 1, 5, 6 e 7)
describe('revisão: a frase do item, as sugestões e o título do grupo', () => {
  const backgrounds = model.fields.get('backgrounds')?.def as {
    catalogHelp?: Record<string, string>
  }
  const withItem = async (name: string) => {
    const sheet: SheetData = {
      values: { ...nova.values, backgrounds: [{ id: 'b1', name, value: 1 }] },
      specialties: {},
    }
    await renderLive(
      { model, sheet, mode: 'evolve' },
      fakeServer(model, sheet).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    fireEvent.press(
      within(screen.getByTestId('editor-backgrounds')).getByRole('button', {
        name: new RegExp(`^${name}`),
      })
    )
  }

  it('item 1: o nome digitado sem acento nem caixa acha a frase', async () => {
    await withItem('aliados')
    expect(screen.getByTestId('item-help')).toHaveTextContent(
      backgrounds.catalogHelp?.Aliados ?? '-'
    )
  })

  it('item 1: a frase acompanha o nome editado na folha', async () => {
    await withItem('Aliados')
    const sheet = within(screen.getByTestId('item-sheet-backgrounds'))
    fireEvent.changeText(sheet.getByLabelText('Nome'), 'Contatos')
    expect(screen.getByTestId('item-help')).toHaveTextContent(
      backgrounds.catalogHelp?.Contatos ?? '-'
    )
    fireEvent.changeText(sheet.getByLabelText('Nome'), 'Nome inventado')
    expect(screen.queryByTestId('item-help')).toBeNull()
  })

  it('item 1: no aspecto (sem name), a busca usa o texto e não quebra', () => {
    expect(nameHelp({ Aspecto: 'Frase.' }, undefined)).toBeNull()
    expect(nameHelp({ Aspecto: 'Frase.' }, 'aspecto')).toEqual({
      subject: 'Aspecto',
      text: 'Frase.',
    })
    expect(nameHelp({ Aspecto: 'Frase.' }, '')).toBeNull()
  })

  it('item 5: 1 sugestão com frase em 30: os chips continuam, e só ela tem "?"', () => {
    const options = Array.from({ length: 30 }, (_, i) => `Arquétipo ${i + 1}`)
    render(
      <ThemeProvider>
        <SuggestionChips
          options={options}
          value=""
          onPick={jest.fn()}
          help={{ 'Arquétipo 7': 'Frase do sétimo, do teste.' }}
          testID="chips"
        />
      </ThemeProvider>
    )
    const flow = StyleSheet.flatten(screen.getByTestId('chips').props.style)
    expect(flow).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' })
    expect(screen.getAllByRole('button', { name: /^Ajuda:/ })).toHaveLength(1)
    fireEvent.press(screen.getByRole('button', { name: 'Ajuda: Arquétipo 7' }))
    expect(screen.getByText('Frase do sétimo, do teste.')).toBeTruthy()
    expect(screen.getByText('Arquétipo 30')).toBeTruthy()
  })

  it('item 7: o título do grupo com âncora e "?" é um componente só', async () => {
    const m = withBlockHelp('vtm-v20', 'merits-flaws', 'merits')
    await renderLive(
      { model: m, sheet: nova, mode: 'evolve' },
      fakeServer(m, nova).post
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const help = screen.getByTestId('group-help-merits')
    expect(help.props.accessibilityLabel).toBe('Ajuda: Qualidades')
    // O título continua cabeçalho (o alvo do foco do "ir ao grupo")
    expect(screen.getByRole('header', { name: 'Qualidades' })).toBeTruthy()
  })
})

// P17 (N-01, N-02): no Lobisomem, Nome de feito, Seita e Campo ganham a
// frase no template, e o "?" aparece sozinho (o editor de texto o desenha a
// partir do `help`). O rótulo "Nome de feito" fica (decisão 1 do P17)
describe('W20: o "?" de Nome de feito, Seita e Campo', () => {
  const w20 = modelOf('wta-w20')
  const sheet: SheetData = {
    values: {
      name: 'Iara',
      breed: 'hominideo',
      auspice: 'galliard',
      tribe: 'fianna',
    },
    specialties: {},
  }
  it.each([
    ['deedName', 'Nome de feito', /feito marcante/],
    ['sept', 'Seita', /caern/],
    ['camp', 'Campo', /facção dentro da tribo/],
  ])('%s: o "?" abre a frase do time', async (id, label, text) => {
    expect(w20.fields.get(id)?.def.label).toBe(label)
    expect(w20.fields.get(id)?.def.help).toMatch(text)
    await renderLive(
      { model: w20, sheet, mode: 'evolve' },
      fakeServer(w20, sheet).post
    )
    const help = screen.getByRole('button', { name: `Ajuda: ${label}` })
    fireEvent.press(help)
    expect(screen.getByText(text)).toBeTruthy()
  })
})
