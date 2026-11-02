import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native'
import { KeyboardArea } from '@tms/ui'
import { useRouter } from 'expo-router'
import { Dimensions, ScrollView, StyleSheet, TextInput } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, ok } from '../../test/fake-api'
import { example, modelOf, sheetFor, templateJson } from '../../test/fixtures'
import { fakeServer, type LiveProps, renderLive } from '../../test/live'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import { CharacterForm } from '../CharacterForm'
import { identityColumnsPerRow } from '../IdentityBlock'
import { SheetScreen } from '../SheetScreen'

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
      // O menu fecha e o Histórico abre no mesmo toque
      expect(screen.queryByRole('header', { name: 'Mais opções' })).toBeNull()
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
    expect(screen.getByRole('header', { name: 'Experiência' })).toBeTruthy()
  })

  it('o narrador vê o estado no item e chega às ações', async () => {
    resize(PHONE)
    await openSheet(['storyteller'], 'creating')
    fireEvent.press(menu())
    fireEvent.press(
      screen.getByRole('button', { name: 'Ações do narrador · Em criação' })
    )
    expect(screen.getByTestId('status-complete')).toBeTruthy()
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
