import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fireEvent, render, screen } from '@testing-library/react-native'
import {
  compileTemplate,
  describe as fieldDescribe,
  REGISTRY,
  type RoleName,
  resolve,
  type SheetData,
  type SheetModel,
} from '@tms/sheet-core'
import { isEmblem } from '@tms/ui'
import {
  example,
  modelOf,
  sheetFor,
  templateJson,
  VAMPIRES,
} from '../../test/fixtures'
import { layoutFor, layouts } from '../layouts'
import { ListLayout } from '../layouts/ListLayout'
import { SheetView } from '../SheetView'
import { resolveView } from '../views'
import { FieldDetail } from '../views/FieldDetail'
import { GenericChip } from '../views/GenericChip'
import { GenericFact, GenericRow } from '../views/GenericRow'

// Etapa 13: qualquer ficha aparece inteira em Leitura, com o GenericRow, e o
// leitor de tela ouve a frase do describe() de cada campo.

function renderSheet(model: SheetModel, sheet: SheetData, roles: RoleName[]) {
  return render(<SheetView model={model} sheet={sheet} roles={roles} />)
}

/**
 * Percorre as abas e confere que todo campo legível foi desenhado. Seção com
 * filtro ligado por padrão ("Só com pontos") mostra tudo com "Mostrar todos".
 */
function expectEveryField(
  model: SheetModel,
  sheet: SheetData,
  roles: RoleName[]
) {
  const resolved = resolve(model, sheet)
  const seen = new Set<string>()
  const check = (zoneId: string) => {
    for (const all of screen.queryAllByRole('button', {
      name: 'Mostrar todos',
    }))
      fireEvent.press(all)
    const zone = model.zones.find(z => z.id === zoneId)
    for (const s of zone?.sections ?? [])
      for (const id of s.fieldIds) {
        if (s.restricted && !roles.includes('storyteller')) continue
        const r = resolved.get(id)
        if (!r) continue
        expect(
          screen.getAllByLabelText(fieldDescribe(r, resolved)).length
        ).toBeGreaterThan(0)
        seen.add(id)
      }
  }
  check('identity')
  check('play')
  const tabs = screen.queryAllByRole('tab')
  for (const tab of tabs) {
    fireEvent.press(tab)
    const zone = model.zones.find(z => z.label === tab.props.accessibilityLabel)
    if (zone) check(zone.id)
  }
  return seen
}

describe('as fichas de Vampiro em Leitura', () => {
  it.each(VAMPIRES)('%s: identidade, Em jogo e as 3 abas', id => {
    const { model, sheet } = sheetFor(id, ['storyteller'])
    renderSheet(model, sheet, ['storyteller'])
    expect(
      screen.getAllByRole('tab').map(t => t.props.accessibilityLabel)
    ).toEqual(['Ficha', 'Vantagens', 'Sobre'])
    const seen = expectEveryField(model, sheet, ['storyteller'])
    // Todo campo citado por alguma seção apareceu
    const cited = new Set(
      model.zones.flatMap(z => z.sections.flatMap(s => s.fieldIds))
    )
    expect([...cited].filter(f => !seen.has(f))).toEqual([])
  })

  it('o nome é o título, com o selo e o resumo', () => {
    const { model, sheet } = sheetFor('helena', ['owner'])
    renderSheet(model, sheet, ['owner'])
    expect(screen.getByText('Helena Varga')).toBeTruthy()
    expect(screen.queryByRole('header', { name: 'Helena Varga' })).toBeNull()
    expect(screen.getByText('Tremere')).toBeTruthy()
    expect(screen.getByText('Arquivista da Capela · 8ª geração')).toBeTruthy()
  })

  it.each([
    ['helena', 'ankh'],
    ['tomas', 'nine-star'],
    ['iara', 'claws'],
  ])('o cabeçalho de %s mostra o símbolo da criatura (%s)', (id, emblem) => {
    const { model, sheet } = sheetFor(id, ['owner'])
    renderSheet(model, sheet, ['owner'])
    expect(
      screen.getByTestId(`emblem-${emblem}`, { includeHiddenElements: true })
    ).toBeTruthy()
  })

  it('sistema sem emblema (D&D) mantém as iniciais', () => {
    const { model, sheet } = sheetFor('lia', ['owner'])
    renderSheet(model, sheet, ['owner'])
    expect(
      screen.queryByTestId(/^emblem-/, { includeHiddenElements: true })
    ).toBeNull()
  })

  it('todo emblema da lista fechada do core tem desenho no @tms/ui', () => {
    expect(REGISTRY.emblems.filter(e => !isEmblem(e))).toEqual([])
  })

  it('a dona não vê a seção do narrador (nem o título)', () => {
    const { model, sheet } = sheetFor('helena', ['owner'])
    expect(Object.hasOwn(sheet.values, 'storytellerNotes')).toBe(false)
    renderSheet(model, sheet, ['owner'])
    fireEvent.press(screen.getByRole('tab', { name: 'Sobre' }))
    expect(screen.queryByText('Narrador')).toBeNull()
    expect(screen.queryByLabelText(/Notas do Narrador/)).toBeNull()
    expect(screen.getByLabelText(/^Notas: /)).toBeTruthy()
  })

  it('o narrador vê as Notas do Narrador', () => {
    const { model, sheet } = sheetFor('helena', ['storyteller'])
    renderSheet(model, sheet, ['storyteller'])
    fireEvent.press(screen.getByRole('tab', { name: 'Sobre' }))
    expect(screen.getByText('Narrador')).toBeTruthy()
    expect(screen.getByLabelText(/^Notas do Narrador: /)).toBeTruthy()
  })

  it('a citação aparece na voz da skin, entre aspas', () => {
    const { model, sheet } = sheetFor('helena', ['owner'])
    renderSheet(model, sheet, ['owner'])
    fireEvent.press(screen.getByRole('tab', { name: 'Sobre' }))
    expect(
      screen.getByText(
        '“Todo segredo tem um preço. Eu apenas anoto quem pagou.”'
      )
    ).toHaveStyle({ fontStyle: 'italic' })
  })

  it('aba sem seção legível some', () => {
    const t = templateJson('vtm-v20')
    t.sections = (t.sections as { id: string }[]).filter(s => s.id !== 'about')
    const model = compileTemplate(t)
    const sheet = {
      values: { name: 'Sem Sobre' },
      specialties: {},
    } as SheetData
    renderSheet(model, sheet, ['owner'])
    expect(
      screen.getAllByRole('tab').map(tab => tab.props.accessibilityLabel)
    ).toEqual(['Ficha', 'Vantagens'])
  })

  it('ficha vazia (recém-criada) abre com os padrões', () => {
    const model = modelOf('vtm-v20')
    renderSheet(model, { values: { name: 'Nova' }, specialties: {} }, ['owner'])
    expect(screen.getByLabelText('Força, 1 de 5')).toBeTruthy()
    expect(screen.getByLabelText('Pontos de Sangue, 10 de 10')).toBeTruthy()
    expect(
      screen.getByLabelText('Vitalidade: Sem ferimentos; sem dano')
    ).toBeTruthy()
  })
})

describe('outros sistemas abrem com o mesmo código (anti-acoplamento)', () => {
  it.each(['lia', 'joana', 'dandara', 'tomas', 'iara'])(
    '%s abre sem erro',
    id => {
      const c = example(id)
      const model = modelOf(c.system)
      renderSheet(model, c.sheet, ['owner'])
      expectEveryField(model, c.sheet, ['owner'])
    }
  )
})

describe('registry de views e de layouts', () => {
  it('a ordem de resolução: skin, variante, linha, genérica', () => {
    const Skin = () => null
    const Cell = () => null
    const Row = () => null
    const views = { rating: { cell: Cell, row: Row } } as never
    const skins = {
      wod: { rating: { cell: Skin } },
      dnd: {},
      coc: {},
      fate: {},
    }
    expect(resolveView('wod', 'rating', 'cell', views, skins)).toBe(Skin)
    expect(resolveView('dnd', 'rating', 'cell', views, skins)).toBe(Cell)
    expect(resolveView('dnd', 'rating', 'editor', views, skins)).toBe(Row)
    expect(resolveView('dnd', 'number', 'editor', views, skins)).toBe(
      GenericRow
    )
    expect(resolveView('dnd', 'number', 'fact', views, skins)).toBe(GenericFact)
    // Chip do dock e sheet não caem numa linha: têm genéricos próprios
    expect(resolveView('dnd', 'rating', 'chip', views, skins)).toBe(GenericChip)
    expect(resolveView('dnd', 'number', 'sheet', views, skins)).toBe(
      FieldDetail
    )
    expect(
      resolveView('dnd', 'constructor' as never, 'row', views, skins)
    ).toBe(GenericRow)
  })

  it('layout desconhecido degrada para lista', () => {
    expect(layoutFor('html')).toBe(ListLayout)
    expect(layoutFor('constructor')).toBe(ListLayout)
    expect(layoutFor('pyramid')).toBe(layouts.pyramid)
  })
})

describe('segurança do renderizador', () => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== '__tests__') walk(p)
      } else if (/\.(ts|tsx)$/.test(name)) files.push(p)
    }
  }
  walk(join(__dirname, '..'))

  it.each([
    ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
    ['WebView', /WebView|react-native-webview/],
    ['eval / new Function', /\beval\(|new Function\(/],
  ])('nenhum %s em sheet/', (_, pattern) => {
    const hits = files.filter(f => pattern.test(readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})
