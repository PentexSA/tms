import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { effectiveCreationConfig } from '@tms/sheet-core'
import { KeyboardArea } from '@tms/ui'
import { useRouter } from 'expo-router'
import { Dimensions, ScrollView, StyleSheet, TextInput } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, ok } from '../../test/fake-api'
import { example, modelOf, sheetFor, templateJson } from '../../test/fixtures'
import { fakeServer, type LiveProps, renderLive } from '../../test/live'
import { sheetsDismissed } from '../../test/queries'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import { CharacterForm } from '../CharacterForm'
import { SheetProvider } from '../context'
import { identityColumnsPerRow } from '../IdentityBlock'
import { currentSection } from '../layouts/groupTabsState'
import { SectionView } from '../SectionView'
import { SheetScreen } from '../SheetScreen'
import { SheetView } from '../SheetView'
import { createSheetStore } from '../store/sheetStore'

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning' },
}))
jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

// P08 (onda 2): layout e teclado na ficha. Cada caso é a regressão de um
// achado da matriz (doc/testes/2026-11-01/matriz-achados.md).

/**
 * Quem recebeu focus(): o mock do TextInput compartilha um jest.fn entre as
 * instâncias, então a prova é o `this` de cada chamada.
 */
function focusSpy() {
  const inputs = screen.UNSAFE_getAllByType(TextInput)
  const spy = jest.spyOn(inputs[0]!.instance as { focus: () => void }, 'focus')
  spy.mockClear()
  return () =>
    spy.mock.contexts.map(
      c => inputs.find(el => el.instance === c)?.props.testID
    )
}

const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }
const DESKTOP = { width: 1280, height: 800, scale: 1, fontScale: 1 }
type Size = typeof PHONE
const resize = (size: Size) =>
  act(() => Dimensions.set({ window: size, screen: size }))
afterEach(() => resize(TABLET))

const vtm = modelOf('vtm-v20')
const helena = () => sheetFor('helena', ['owner']).sheet

async function renderSheet(
  props: Partial<LiveProps> & { readonly system?: string } = {}
) {
  const model = props.system ? modelOf(props.system) : vtm
  const sheet = props.sheet ?? helena()
  return renderLive(
    { mode: 'evolve', ...props, model, sheet },
    fakeServer(model, sheet).post
  )
}

describe('T-26: a rolagem da ficha encolhe acima do teclado', () => {
  it('a rolagem fica dentro do KeyboardArea; o seletor de modo e a barra ficam fora', async () => {
    await renderSheet()
    const area = screen.UNSAFE_getByType(KeyboardArea)
    expect(area.findAllByType(ScrollView)).toHaveLength(1)
    expect(within(area).queryByLabelText('Modo da ficha')).toBeNull()
    expect(screen.getByLabelText('Modo da ficha')).toBeTruthy()
  })
})

describe('T-26: "Próximo" entre os campos da Nova ficha', () => {
  it('W20: cada campo de texto foca o seguinte, na ordem do formulário; o último não envia', () => {
    const onSubmit = jest.fn()
    render(<CharacterForm model={modelOf('wta-w20')} onSubmit={onSubmit} />)
    const texts = screen
      .UNSAFE_getAllByType(TextInput)
      .map(el => el.props.testID as string)
    // Só os textos de uma linha; os campos de escolha ficam fora
    expect(texts[0]).toBe('editor-name')
    expect(texts).toContain('editor-packName')
    const focused = focusSpy()
    for (const id of texts.slice(0, -1)) {
      const input = screen.getByTestId(id)
      expect(input.props.returnKeyType).toBe('next')
      fireEvent(input, 'submitEditing')
    }
    expect(focused()).toEqual(texts.slice(1))

    const last = screen.getByTestId(texts.at(-1)!)
    expect(last.props.returnKeyType).toBe('done')
    expect(last.props.onSubmitEditing).toBeUndefined()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('V20: o Clã (escolha) fica fora da cadeia', () => {
    render(<CharacterForm model={modelOf('vtm-v20')} onSubmit={jest.fn()} />)
    const texts = screen
      .UNSAFE_getAllByType(TextInput)
      .map(el => el.props.testID as string)
    expect(texts).toEqual([
      'editor-name',
      'editor-nature',
      'editor-demeanor',
      'editor-concept',
      'editor-sire',
    ])
    const focused = focusSpy()
    fireEvent(screen.getByTestId('editor-name'), 'submitEditing')
    fireEvent(screen.getByTestId('editor-demeanor'), 'submitEditing')
    expect(focused()).toEqual(['editor-nature', 'editor-concept'])
    expect(screen.getByTestId('editor-sire').props.returnKeyType).toBe('done')
  })
})

const IDENTITY_LABELS =
  /^(Nome|Natureza|Comportamento|Conceito|Clã|Geração|Senhor|Nome de feito|Seita|Raça|Augúrio|Acampamento|Tribo|Matilha|Totem)$/

describe('T-65: identidade em duas colunas quando três não cabem', () => {
  it('a conta: 120 dp por coluna, que crescem com a fonte, até as do template', () => {
    expect(identityColumnsPerRow(393, 1, 3)).toBe(2)
    expect(identityColumnsPerRow(360, 1, 3)).toBe(2)
    expect(identityColumnsPerRow(411, 1, 3)).toBe(2)
    expect(identityColumnsPerRow(750, 1, 3)).toBe(3)
    expect(identityColumnsPerRow(1280, 1, 3)).toBe(3)
    expect(identityColumnsPerRow(393, 2, 3)).toBe(1)
    expect(identityColumnsPerRow(200, 1, 3)).toBe(1)
  })

  const columnsAt = async (size: Size, system = 'vtm-v20') => {
    resize(size)
    const model = modelOf(system)
    await renderLive(
      { model, sheet: { values: { name: 'Nova' }, specialties: {} } },
      fakeServer(model, { values: { name: 'Nova' }, specialties: {} }).post
    )
    fireEvent.press(screen.getByRole('radio', { name: 'Editar' }))
    return screen.getByTestId('identity-columns').children.map(col => ({
      width:
        typeof col === 'string'
          ? undefined
          : StyleSheet.flatten(col.props.style)?.width,
      labels: within(col as never)
        .getAllByText(IDENTITY_LABELS)
        .map(t => t.props.children),
    }))
  }

  it.each([
    ['393', { ...PHONE, width: 393 }],
    ['360', { ...PHONE, width: 360 }],
  ])('V20 a %s: 2 por linha, na ordem do template', async (_, size) => {
    const cols = await columnsAt(size)
    expect(cols.map(c => c.width)).toEqual(['50%', '50%', '50%'])
    expect(cols.map(c => c.labels)).toEqual([
      ['Nome'],
      ['Natureza', 'Comportamento', 'Conceito'],
      ['Clã', 'Geração', 'Senhor'],
    ])
  })

  it('V20 a 1280: as 3 colunas da ficha impressa', async () => {
    const cols = await columnsAt(DESKTOP)
    expect(cols.map(c => c.width)).toEqual([
      `${100 / 3}%`,
      `${100 / 3}%`,
      `${100 / 3}%`,
    ])
  })

  it('fonte de 200%: uma coluna', async () => {
    const cols = await columnsAt({ ...PHONE, fontScale: 2 })
    expect(cols.map(c => c.width)).toEqual(['100%', '100%', '100%'])
  })

  it('W20 a 390: a primeira coluna com 4 campos, a quebra preserva cada coluna', async () => {
    const cols = await columnsAt(PHONE, 'wta-w20')
    expect(cols).toHaveLength(3)
    expect(cols.map(c => c.width)).toEqual(['50%', '50%', '50%'])
    expect(cols[0]!.labels).toHaveLength(4)
  })
})

describe('T-11: o cabeçalho da ficha cabe na tela', () => {
  const ID = '00000000-0000-4000-8000-00000000c001'
  beforeEach(() => {
    jest
      .mocked(useRouter)
      .mockReturnValue({ push: jest.fn(), replace: jest.fn() } as never)
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    calls.historyGet.mockResolvedValue(ok({ items: [], next: null }))
  })

  async function openSheet(
    roles: string[],
    status = 'creating',
    extra: Record<string, unknown> = {}
  ) {
    calls.characterGet.mockResolvedValue(
      ok({
        id: ID,
        name: 'Helena Varga',
        chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
        owner: { id: 'u1', username: 'dona' },
        systemCode: 'vtm-v20',
        templateVersion: '1.0.0',
        sheetVersion: 3,
        roles,
        status,
        lockedAt: null,
        member: true,
        updatedAt: '2026-10-18T12:00:00Z',
        sheet: example('helena').sheet,
        ...extra,
      })
    )
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
    expect(await screen.findByLabelText('Destreza, 2 de 5')).toBeTruthy()
  }
  const menu = () => screen.getByRole('button', { name: 'Mais opções' })

  it.each([
    ['390', PHONE],
    ['750', TABLET],
  ])(
    'a %s, um "Mais opções" só; o menu tem Experiência e Histórico',
    async (_, size) => {
      resize(size)
      await openSheet(['owner'], 'active')
      expect(screen.queryByRole('button', { name: 'Histórico' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Experiência' })).toBeNull()
      expect(
        screen.getAllByRole('button', { name: 'Mais opções' })
      ).toHaveLength(1)
      fireEvent.press(menu())
      expect(screen.getByRole('header', { name: 'Mais opções' })).toBeTruthy()
      // O dono não tem as ações do narrador
      expect(
        screen.queryByRole('button', { name: /^Ações do narrador/ })
      ).toBeNull()
      fireEvent.press(screen.getByRole('button', { name: 'Histórico' }))
      // O menu fecha; o Histórico abre depois que ele sai da tela
      expect(screen.queryByRole('header', { name: 'Mais opções' })).toBeNull()
      expect(
        screen.queryByRole('header', { name: 'Histórico de alterações' })
      ).toBeNull()
      await sheetsDismissed()
      expect(
        screen.getByRole('header', { name: 'Histórico de alterações' })
      ).toBeTruthy()
    }
  )

  it('"Experiência" pelo menu abre o extrato', async () => {
    resize(PHONE)
    await openSheet(['owner'], 'active')
    fireEvent.press(menu())
    fireEvent.press(screen.getByRole('button', { name: 'Experiência' }))
    expect(screen.queryByRole('header', { name: 'Mais opções' })).toBeNull()
    await sheetsDismissed()
    expect(screen.getByRole('header', { name: 'Experiência' })).toBeTruthy()
  })

  it('o narrador vê o estado no item e chega às ações', async () => {
    resize(PHONE)
    await openSheet(['storyteller'], 'creating')
    fireEvent.press(menu())
    fireEvent.press(
      screen.getByRole('button', { name: 'Ações do narrador · Em criação' })
    )
    await sheetsDismissed()
    expect(screen.getByTestId('status-complete')).toBeTruthy()
  })

  it('sem rótulo de estado (ativa, destravada), o item diz só "Ações do narrador"', async () => {
    resize(PHONE)
    await openSheet(['storyteller'], 'active')
    fireEvent.press(menu())
    fireEvent.press(screen.getByRole('button', { name: /^Ações do narrador$/ }))
    await sheetsDismissed()
    expect(screen.getByTestId('status-lock')).toBeTruthy()
    fireEvent.press(screen.getAllByRole('button', { name: 'Fechar' })[0]!)
    expect(screen.queryByTestId('status-lock')).toBeNull()
  })

  it('a 1280: os botões no cabeçalho, como antes, sem o "Mais opções"', async () => {
    resize(DESKTOP)
    await openSheet(['owner'], 'active')
    expect(screen.queryByRole('button', { name: 'Mais opções' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Experiência' })).toBeTruthy()
  })

  it('a ficha revelada (viewer) não ganha o menu', async () => {
    resize(PHONE)
    calls.characterGet.mockResolvedValue(
      ok({
        projection: 'full',
        id: ID,
        kind: 'npc',
        visibility: 'full',
        identity: {
          name: 'Oráculo',
          chip: '',
          subtitle: null,
          portraitUrl: null,
        },
        chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
        systemCode: 'vtm-v20',
        templateVersion: '1.0.0',
        roles: ['viewer'],
        status: 'active',
        lockedAt: null,
        sheet: example('helena').sheet,
      })
    )
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} />, session)
    expect(await screen.findByLabelText('Destreza, 2 de 5')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mais opções' })).toBeNull()
  })

  it('T-27: a barra do narrador rola com a ficha no celular e fica fixa no desktop', async () => {
    const inScroll = () =>
      within(
        screen.UNSAFE_getByType(KeyboardArea).findAllByType(ScrollView)[0]!
      ).queryByRole('button', { name: 'Editar como narrador' })
    resize(PHONE)
    await openSheet(['storyteller'], 'active')
    expect(inScroll()).toBeTruthy()
    screen.unmount()
    resize(DESKTOP)
    await openSheet(['storyteller'], 'active')
    expect(
      screen.getByRole('button', { name: 'Editar como narrador' })
    ).toBeTruthy()
    expect(inScroll()).toBeNull()
  })

  it('no celular, o "N alterações não salvas" quebra em 2 linhas numa largura fixa', async () => {
    resize(PHONE)
    await openSheet(['owner'], 'creating')
    const sync = screen.getByTestId(/^sync-/)
    expect(StyleSheet.flatten(sync.props.style).maxWidth).toBe(112)
    expect(within(sync).getByText(/^Salvo|alteraç/).props.numberOfLines).toBe(2)
  })
})

describe('T-59: "Em jogo" recolhido na Criação', () => {
  it('na Criação: começa recolhido, sem a Vitalidade; um toque mostra', async () => {
    resize(TABLET)
    await renderSheet({ mode: 'create' })
    const toggle = screen.getByRole('button', { name: 'Em jogo' })
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false })
    expect(screen.queryByLabelText(/^Vitalidade/)).toBeNull()
    fireEvent.press(toggle)
    expect(
      screen.getByRole('button', { name: 'Em jogo' }).props.accessibilityState
    ).toMatchObject({ expanded: true })
    expect(screen.getAllByLabelText(/^Vitalidade/).length).toBeGreaterThan(0)
  })

  it.each(['play', 'evolve'] as const)(
    'em %s: aberto como antes, com o título de grupo',
    async mode => {
      resize(TABLET)
      await renderSheet({ mode })
      expect(screen.queryByRole('button', { name: 'Em jogo' })).toBeNull()
      expect(screen.getByRole('header', { name: 'Em jogo' })).toBeTruthy()
      expect(screen.getAllByLabelText(/^Vitalidade/).length).toBeGreaterThan(0)
    }
  )
})

describe('T-27 (parte 1): no celular, os controles de modo rolam com a ficha', () => {
  const scroll = () =>
    screen.UNSAFE_getByType(KeyboardArea).findAllByType(ScrollView)[0]!

  it('a 390, Editar: o seletor de modo na rolagem; a barra de ação fixa', async () => {
    resize(PHONE)
    await renderSheet({ mode: 'evolve' })
    expect(within(scroll()).getByLabelText('Modo da ficha')).toBeTruthy()
    expect(within(scroll()).queryByText('Editando · 0 alterações')).toBeNull()
    expect(screen.getByText('Editando · 0 alterações')).toBeTruthy()
  })

  it('a 750: o seletor e a barra fixos acima, como antes', async () => {
    resize(TABLET)
    await renderSheet({ mode: 'evolve' })
    expect(within(scroll()).queryByLabelText('Modo da ficha')).toBeNull()
    expect(screen.getByLabelText('Modo da ficha')).toBeTruthy()
    expect(screen.queryByTestId('sheet-scroll-header')).toBeNull()
  })

  it('a ficha só de leitura (sem quem escreva) não ganha o seletor', async () => {
    resize(PHONE)
    render(
      <SheetView model={vtm} sheet={helena()} roles={['owner']} mode="read" />
    )
    expect(screen.queryByLabelText('Modo da ficha')).toBeNull()
    expect(screen.queryByTestId('sheet-scroll-header')).toBeNull()
  })
})

describe('T-27 (parte 2): abas, sub-abas e contador fixos no celular', () => {
  const ID = '00000000-0000-4000-8000-00000000c201'
  beforeEach(() => {
    jest
      .mocked(useRouter)
      .mockReturnValue({ push: jest.fn(), replace: jest.fn() } as never)
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  })

  async function openCreation() {
    calls.characterGet.mockResolvedValue(
      ok({
        id: ID,
        name: 'Nova',
        chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
        owner: { id: 'u1', username: 'dona' },
        systemCode: 'vtm-v20',
        templateVersion: '1.0.0',
        sheetVersion: 1,
        roles: ['owner'],
        status: 'creating',
        lockedAt: null,
        member: true,
        updatedAt: '2026-10-18T12:00:00Z',
        sheet: { values: { name: 'Nova', clan: 'tremere' }, specialties: {} },
        creation: {
          revision: 1,
          mode: 'points',
          accounting: true,
          choices: {
            priorities: {
              attributes: ['physical', 'social', 'mental'],
              abilities: ['talents', 'skills', 'knowledges'],
            },
          },
          config: {},
          effective: effectiveCreationConfig(vtm),
          returned: null,
          approval: false,
        },
      })
    )
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(<SheetScreen id={ID} initialMode="create" />, session)
    await screen.findByRole('tab', { name: 'Orçamento' })
  }
  const nav = () => within(screen.getByTestId('sheet-nav'))
  const layout = (testID: string, y: number, height = 400) =>
    fireEvent(screen.getByTestId(testID), 'layout', {
      nativeEvent: { layout: { x: 0, y, width: 390, height } },
    })
  const scrollTo = (y: number) =>
    fireEvent.scroll(
      screen.UNSAFE_getByType(KeyboardArea).findAllByType(ScrollView)[0]!,
      { nativeEvent: { contentOffset: { x: 0, y } } }
    )

  it('a 390, Criação: a faixa é fixa e leva as abas, as sub-abas da seção no topo e o contador', async () => {
    resize(PHONE)
    await openCreation()
    const scroll = screen
      .UNSAFE_getByType(KeyboardArea)
      .findAllByType(ScrollView)[0]!
    const children = scroll.props.children as { key: string }[]
    const sticky = scroll.props.stickyHeaderIndices as number[]
    expect(children[sticky[0]!]!.key).toBe('nav')
    // No topo da zona: os Atributos
    expect(nav().getByRole('tab', { name: 'Orçamento' })).toBeTruthy()
    expect(nav().getByLabelText('Grupos de Atributos')).toBeTruthy()
    expect(nav().getByTestId('counter-physical')).toBeTruthy()
    // O corpo não repete a barra
    expect(
      within(screen.getByTestId('grid-attributes')).queryByRole('tab')
    ).toBeNull()

    // Rolando até as Habilidades, a faixa troca de seção
    layout('sheet-panel', 600)
    layout('sheet-nav', 500, 120)
    layout('section-attributes', 0)
    layout('section-abilities', 900)
    scrollTo(1450)
    expect(nav().queryByLabelText('Grupos de Atributos')).toBeNull()
    expect(nav().getByLabelText('Grupos de Habilidades')).toBeTruthy()
    expect(nav().getByTestId('counter-talents')).toBeTruthy()
    // Trocar a sub-aba na faixa filtra o corpo
    expect(screen.queryByRole('adjustable', { name: 'Condução' })).toBeNull()
    fireEvent.press(nav().getByRole('tab', { name: 'Perícias' }))
    expect(screen.getByRole('adjustable', { name: 'Condução' })).toBeTruthy()
    expect(nav().getByTestId('counter-skills')).toBeTruthy()
    // De volta ao topo: os Atributos, com a escolha das Habilidades guardada
    scrollTo(0)
    expect(nav().getByLabelText('Grupos de Atributos')).toBeTruthy()
    // "Orçamento" a um toque, sem voltar ao topo
    scrollTo(1450)
    fireEvent.press(nav().getByRole('tab', { name: 'Orçamento' }))
    expect(nav().getByRole('tab', { name: 'Orçamento' })).toBeSelected()
  })

  it('a 750: as abas da zona continuam fixas; sub-abas não há', async () => {
    resize(TABLET)
    await openCreation()
    expect(nav().getByRole('tab', { name: 'Orçamento' })).toBeTruthy()
    expect(nav().queryByLabelText(/^Grupos de/)).toBeNull()
    expect(screen.queryByTestId('group-tabs-attributes')).toBeNull()
  })
})

describe('groupTabsState: a seção atual', () => {
  it('a última que passou da faixa; no topo, a primeira; sem seções, nenhuma', () => {
    const list = [
      { id: 'b', y: 900 },
      { id: 'a', y: 0 },
    ]
    expect(currentSection(list, 100)).toBe('a')
    expect(currentSection(list, 950)).toBe('b')
    expect(currentSection([{ id: 'a', y: 400 }], 10)).toBe('a')
    expect(currentSection([], 10)).toBeNull()
  })
})

describe('sub-abas sem a faixa (fora do SheetView)', () => {
  it('cada seção guarda a própria aba, com a barra no corpo', () => {
    resize(PHONE)
    const store = createSheetStore({
      characterId: 'c1',
      model: vtm,
      sheet: helena(),
      sheetVersion: 1,
      roles: ['owner'],
      mode: 'evolve',
    })
    store.getState().startDraft()
    const section = vtm.zones
      .flatMap(z => z.sections)
      .find(s => s.id === 'attributes')!
    render(
      <SheetProvider store={store}>
        <SectionView section={section} />
      </SheetProvider>
    )
    const bar = within(screen.getByTestId('group-tabs-attributes'))
    expect(bar.getByRole('tab', { name: 'Físicos' })).toBeSelected()
    expect(screen.queryByRole('adjustable', { name: 'Carisma' })).toBeNull()
    fireEvent.press(bar.getByRole('tab', { name: 'Sociais' }))
    expect(screen.getByRole('adjustable', { name: 'Carisma' })).toBeTruthy()
  })
})

describe('a barra de modos não remonta a ficha quando a política muda', () => {
  const ID = '00000000-0000-4000-8000-00000000c001'
  it('travada pelo narrador: o seletor some e a rolagem continua a mesma', async () => {
    jest
      .mocked(useRouter)
      .mockReturnValue({ push: jest.fn(), replace: jest.fn() } as never)
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const character = (lockedAt: string | null) =>
      ok({
        id: ID,
        name: 'Helena Varga',
        chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
        owner: { id: 'u1', username: 'dona' },
        systemCode: 'vtm-v20',
        templateVersion: '1.0.0',
        sheetVersion: 3,
        roles: ['owner'],
        status: 'active',
        lockedAt,
        member: true,
        updatedAt: '2026-10-18T12:00:00Z',
        sheet: example('helena').sheet,
      })
    resize(TABLET)
    calls.characterGet.mockResolvedValue(character(null))
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    const { queryClient } = renderWithSession(<SheetScreen id={ID} />, session)
    expect(await screen.findByLabelText('Destreza, 2 de 5')).toBeTruthy()
    expect(screen.getByLabelText('Modo da ficha')).toBeTruthy()
    const before = screen.UNSAFE_getByType(ScrollView).instance

    calls.characterGet.mockResolvedValue(character('2026-10-18T12:00:00Z'))
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ['characters', ID] })
    )
    expect(await screen.findByText('O narrador travou a ficha')).toBeTruthy()
    expect(screen.queryByLabelText('Modo da ficha')).toBeNull()
    expect(screen.UNSAFE_getByType(ScrollView).instance).toBe(before)
  })
})
