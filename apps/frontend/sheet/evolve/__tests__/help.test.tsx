import { fireEvent, screen, within } from '@testing-library/react-native'
import { compileTemplate, type SheetData } from '@tms/sheet-core'
import { modelOf, templateJson } from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'

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
  const [physical] = (attributes?.groups ?? []) as Json[]
  if (physical) physical.help = 'Frase do grupo, do teste.'
  const clan = (t.fields as Record<string, Json>).clan
  const options = (clan?.options ?? []) as Json[]
  const brujah = options.find(o => o.id === 'brujah')
  if (brujah) brujah.help = 'Frase da opção, do teste.'
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
