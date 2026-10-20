import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import {
  compileTemplate,
  type RoleName,
  resolve,
  type SheetData,
  type SheetModel,
} from '@tms/sheet-core'
import { RatingDots } from '@tms/ui'
import {
  example,
  modelOf,
  sheetFor,
  templateJson,
} from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'
import { fold } from '../../evolve/text'
import { SheetView } from '../../SheetView'

// Etapa 18: os layouts ricos. `groups` com filtro e busca; `grid` em colunas
// (variante `cell`), que vira lista com fonte grande ou tela estreita.

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}))
const useWindowDimensions = jest.requireMock(
  'react-native/Libraries/Utilities/useWindowDimensions'
).default as jest.Mock
const dims = (width: number, fontScale = 1) =>
  useWindowDimensions.mockReturnValue({
    width,
    height: 900,
    scale: 2,
    fontScale,
  })

beforeEach(() => dims(800))

const renderSheet = (
  model: SheetModel,
  sheet: SheetData,
  roles: RoleName[] = ['owner']
) => render(<SheetView model={model} sheet={sheet} roles={roles} />)

describe('groups: filtro e busca (Habilidades)', () => {
  const { model, sheet } = sheetFor('helena', ['owner'])
  const abilities = model.zones
    .flatMap(z => z.sections)
    .find(s => s.id === 'abilities')
  const resolved = resolve(model, sheet)
  const ids = abilities?.fieldIds ?? []
  const invested = ids.filter(id => {
    const r = resolved.get(id)
    return r?.type === 'rating' && r.base > 0
  })
  const label = (id: string) => model.fields.get(id)?.def.label ?? id
  // Uma Habilidade sem pontos e com acento no nome ("Condução", "Política")
  const accented = ids
    .filter(id => !invested.includes(id))
    .map(label)
    .find(l => fold(l) !== l.toLowerCase())
  if (!accented) throw new Error('fixture sem habilidade acentuada sem pontos')
  const startsWith = (l: string) => new RegExp(`^${l}, `)

  it('abre filtrado ("Só com pontos") e mostra "Mostrando N de M"', () => {
    renderSheet(model, sheet)
    const section = within(screen.getByTestId('groups-abilities'))
    expect(section.getByRole('switch', { name: 'Só com pontos' })).toBeChecked()
    expect(section.getByText(`Mostrando ${invested.length} de 30`)).toBeTruthy()
    expect(section.queryByLabelText(startsWith(accented))).toBeNull()
    fireEvent.press(section.getByRole('switch', { name: 'Só com pontos' }))
    expect(
      section.getByRole('switch', { name: 'Só com pontos' })
    ).not.toBeChecked()
    expect(section.queryByText(/^Mostrando/)).toBeNull()
    expect(section.getByLabelText(startsWith(accented))).toBeTruthy()
  })

  it('busca sem acento e sem caixa: "ocultismo" acha "Ocultismo"', () => {
    renderSheet(model, sheet)
    const section = within(screen.getByTestId('groups-abilities'))
    const search = section.getByLabelText('Buscar em Habilidades')
    fireEvent.changeText(search, 'OCULTISMO')
    expect(section.getByLabelText(/^Ocultismo, /)).toBeTruthy()
    expect(section.getByText('Mostrando 1 de 30')).toBeTruthy()
    expect(section.getByText('Nada para mostrar em Talentos.')).toBeTruthy()

    fireEvent.changeText(search, fold(accented))
    // Sem pontos: o filtro esconde até "Mostrar todos"
    expect(section.queryByLabelText(startsWith(accented))).toBeNull()
    fireEvent.press(section.getByRole('button', { name: 'Mostrar todos' }))
    expect(search.props.value).toBe('')
    expect(section.getAllByLabelText(/, \d de 5/)).toHaveLength(30)
    fireEvent.changeText(search, fold(accented))
    expect(section.getByLabelText(startsWith(accented))).toBeTruthy()
  })

  it('no celular, fora do Editar: filtro ligado vira chips; desligado, abas', () => {
    dims(390)
    renderSheet(model, sheet)
    const section = within(screen.getByTestId('groups-abilities'))
    // Sem abas: os três grupos à vista, como no protótipo
    expect(section.queryByRole('tab')).toBeNull()
    expect(section.getByRole('header', { name: 'Talentos' })).toBeTruthy()
    expect(section.getByRole('header', { name: 'Conhecimentos' })).toBeTruthy()
    // "Nome N" em fluxo, com o nome acessível da linha completa
    const occult = section.getByLabelText(/^Ocultismo, /)
    expect(within(occult).getByText('Ocultismo')).toBeTruthy()
    expect(
      section.queryAllByTestId('pip-on', { includeHiddenElements: true })
    ).toHaveLength(0)
    // Sem o filtro (todas as 30), linhas com pips em abas, como no Editar
    fireEvent.press(section.getByRole('switch', { name: 'Só com pontos' }))
    expect(section.getByRole('tab', { name: 'Talentos' })).toBeSelected()
    expect(section.queryByRole('header', { name: 'Talentos' })).toBeNull()
    expect(
      section.getAllByTestId('pip-on', { includeHiddenElements: true }).length
    ).toBeGreaterThan(0)
    expect(section.queryByLabelText(/^Ocultismo, /)).toBeNull()
    fireEvent.press(section.getByRole('tab', { name: 'Conhecimentos' }))
    expect(section.getByLabelText(/^Ocultismo, /)).toBeTruthy()
    // A busca procura em todas as abas
    fireEvent.press(section.getByRole('tab', { name: 'Talentos' }))
    fireEvent.changeText(
      section.getByLabelText('Buscar em Habilidades'),
      'ocultismo'
    )
    expect(section.getByLabelText(/^Ocultismo, /)).toBeTruthy()
    // Religar o filtro tira as abas: chips de todos os grupos
    fireEvent.changeText(section.getByLabelText('Buscar em Habilidades'), '')
    fireEvent.press(section.getByRole('switch', { name: 'Só com pontos' }))
    expect(section.queryByRole('tab')).toBeNull()
  })

  it('no Editar do celular, abas por grupo; a busca procura em todos', async () => {
    dims(390)
    await renderLive(
      { model, sheet, mode: 'evolve' },
      fakeServer(model, sheet).post
    )
    const section = within(screen.getByTestId('groups-abilities'))
    expect(section.getByRole('tab', { name: 'Talentos' })).toBeSelected()
    expect(section.queryByRole('adjustable', { name: 'Ocultismo' })).toBeNull()
    fireEvent.press(section.getByRole('tab', { name: 'Conhecimentos' }))
    expect(section.getByRole('adjustable', { name: 'Ocultismo' })).toBeTruthy()

    fireEvent.press(section.getByRole('tab', { name: 'Talentos' }))
    fireEvent.changeText(
      section.getByLabelText('Buscar em Habilidades'),
      'ocultismo'
    )
    // Achou fora da aba aberta, com o título do grupo
    expect(section.getByRole('adjustable', { name: 'Ocultismo' })).toBeTruthy()
    expect(section.getByRole('header', { name: 'Conhecimentos' })).toBeTruthy()
  })

  it('seção sem filtro nem busca (Vantagens) não tem barra', () => {
    renderSheet(model, sheet)
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const section = within(screen.getByTestId('groups-advantages'))
    expect(section.queryByRole('switch')).toBeNull()
    expect(section.queryByLabelText(/^Buscar/)).toBeNull()
    expect(
      section.getByLabelText(
        'Taumaturgia, 3 de 5, especialização Trilha do Sangue'
      )
    ).toBeTruthy()
  })

  it('outros sistemas: o rótulo e a regra vêm do template', () => {
    const coc = example('joana')
    renderSheet(modelOf(coc.system), coc.sheet)
    expect(screen.getByRole('switch', { name: 'Acima da base' })).toBeChecked()
    expect(screen.getByLabelText('Buscar em Perícias')).toBeTruthy()
    expect(screen.getByText(/^Mostrando \d+ de \d+$/)).toBeTruthy()
    screen.unmount()

    const dnd = example('lia')
    renderSheet(modelOf(dnd.system), dnd.sheet)
    expect(
      screen.getByRole('switch', { name: 'Só proficientes' })
    ).toBeChecked()
  })
})

describe('grid: Atributos', () => {
  const { model, sheet } = sheetFor('helena', ['owner'])

  it('em colunas: um grupo por coluna, títulos só visuais, pips grandes no wod', () => {
    renderSheet(model, sheet)
    const grid = within(screen.getByTestId('grid-attributes'))
    expect(grid.queryByRole('header', { name: 'Físicos' })).toBeNull()
    expect(
      grid.getByText('Físicos', { includeHiddenElements: true })
    ).toBeTruthy()
    expect(grid.getByLabelText('Força, 2 de 5')).toBeTruthy()
    const sizes = grid.UNSAFE_getAllByType(RatingDots).map(d => d.props.size)
    expect(sizes).toHaveLength(9)
    expect(new Set(sizes)).toEqual(new Set(['md']))
  })

  it('a skin base usa pips pequenos (o override é só da wod)', () => {
    const t = templateJson('vtm-v20')
    t.skin = 'fate'
    const fate = compileTemplate(t)
    renderSheet(fate, sheet)
    const grid = within(screen.getByTestId('grid-attributes'))
    const sizes = grid.UNSAFE_getAllByType(RatingDots).map(d => d.props.size)
    expect(new Set(sizes)).toEqual(new Set(['sm']))
  })

  it('fonte grande: a grade vira lista com títulos', () => {
    dims(800, 1.4)
    renderSheet(model, sheet)
    const grid = within(screen.getByTestId('grid-attributes'))
    expect(grid.getByRole('header', { name: 'Físicos' })).toBeTruthy()
    expect(grid.getByLabelText('Força, 2 de 5')).toBeTruthy()
  })

  it('celular, fora do Editar: a grade 3×3 inteira, sem abas', () => {
    dims(390)
    renderSheet(model, sheet)
    const grid = within(screen.getByTestId('grid-attributes'))
    expect(grid.queryByRole('tab')).toBeNull()
    expect(grid.getByLabelText('Força, 2 de 5')).toBeTruthy()
    expect(grid.getByLabelText(/^Carisma/)).toBeTruthy()
    expect(grid.getByLabelText(/^Raciocínio/)).toBeTruthy()
  })

  it('tela estreita (< 360): a grade vira lista com os títulos dos grupos', () => {
    dims(340)
    renderSheet(model, sheet)
    const grid = within(screen.getByTestId('grid-attributes'))
    expect(grid.queryByRole('tab')).toBeNull()
    expect(grid.getByRole('header', { name: 'Físicos' })).toBeTruthy()
    expect(grid.getByRole('header', { name: 'Sociais' })).toBeTruthy()
    expect(grid.getByLabelText('Força, 2 de 5')).toBeTruthy()
  })

  it('Editar no celular: lista com Stepper; no tablet, colunas', async () => {
    dims(390)
    await renderLive(
      { model, sheet, mode: 'evolve' },
      fakeServer(model, sheet).post
    )
    let grid = within(screen.getByTestId('grid-attributes'))
    expect(grid.getByRole('tab', { name: 'Físicos' })).toBeSelected()
    expect(grid.getByRole('adjustable', { name: 'Força' })).toBeTruthy()
    screen.unmount()

    dims(800)
    await renderLive(
      { model, sheet, mode: 'evolve' },
      fakeServer(model, sheet).post
    )
    grid = within(screen.getByTestId('grid-attributes'))
    expect(grid.queryByRole('header', { name: 'Físicos' })).toBeNull()
    expect(grid.queryByRole('tab', { name: 'Físicos' })).toBeNull()
    expect(grid.getByRole('adjustable', { name: 'Força' })).toBeTruthy()
  })

  it('grade sem grupos (características do CoC) quebra em colunas', () => {
    const coc = example('joana')
    renderSheet(modelOf(coc.system), coc.sheet)
    expect(screen.getByTestId('grid-characteristics')).toBeTruthy()
  })
})

describe('outros sistemas em Editar', () => {
  it.each(['lia', 'joana', 'dandara', 'tomas', 'iara'])(
    '%s: editores sobem sem erro e o rascunho aceita alterações',
    async id => {
      const c = example(id)
      const model = modelOf(c.system)
      const { store } = await renderLive(
        { model, sheet: c.sheet, mode: 'evolve' },
        fakeServer(model, c.sheet).post
      )
      const steppers = screen.queryAllByRole('adjustable')
      expect(steppers.length).toBeGreaterThan(0)
      const first = steppers[0]
      if (!first) throw new Error('sem stepper')
      fireEvent(first, 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      })
      fireEvent(first, 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
      fireEvent(first, 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      })
      expect(store().getState().draft).not.toBeNull()
    }
  )
})

describe('a ficha de papel: Vantagens do Vampiro', () => {
  it('Qualidades, Defeitos, Fraqueza e Experiência na aba Vantagens', () => {
    const { model, sheet } = sheetFor('helena', ['owner'])
    renderSheet(model, sheet)
    fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
    const advantages = within(screen.getByTestId('groups-advantages'))
    expect(advantages.getByText('Fraqueza do clã')).toBeTruthy()
    const merits = within(screen.getByTestId('groups-merits-flaws'))
    expect(
      merits.getByLabelText('Memória Eidética, Tipo Mental, Custo 2')
    ).toBeTruthy()
    expect(merits.getByLabelText('Inimigo, Tipo Social, Bônus 2')).toBeTruthy()
    const xp = within(screen.getByTestId('groups-experience'))
    expect(xp.getByText('Experiência disponível')).toBeTruthy()
    // Total 14, gasta 9: o disponível é calculado, como no quadro do papel
    expect(xp.getByText('5')).toBeTruthy()
  })
})
