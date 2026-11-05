import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import {
  useFocusEffect,
  useLocalSearchParams,
  usePreventRemove,
  useRouter,
} from 'expo-router'
import { Platform } from 'react-native'
import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import { templateJson } from '../../test/fixtures'
import { sheetsDismissed } from '../../test/queries'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen from '../(app)/chronicles/[id]/index'
import NewCharacterScreen from '../(app)/chronicles/[id]/new-character'

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
// Uma chave de verdade por intenção (T-02)
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}))
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const CHRONICLE = '00000000-0000-4000-8000-0000000000c1'
const VTM = { code: 'vtm-v20', name: 'Vampiro: A Máscara' }

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE })
  calls.chronicle.get.mockResolvedValue(
    ok({
      id: CHRONICLE,
      name: 'Crônica da Liberdade',
      system: VTM,
      role: 'player',
      storyteller: { id: 'u1', username: 'ana' },
      members: [],
    })
  )
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

describe('Nova ficha', () => {
  it('cria pela identidade e abre a ficha', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(ok({ id: 'ch1' }))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(
      await screen.findByTestId('editor-name'),
      'Helena Varga'
    )
    fireEvent.press(screen.getByRole('radio', { name: 'Tremere' }))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(calls.chronicle.charactersPost).toHaveBeenCalledWith({
      values: { name: 'Helena Varga', clan: 'tremere' },
      clientCommandId: expect.any(String),
    })
    // O Vampiro tem criação por pontos: a ficha nova abre na Criação
    expect(router.replace).toHaveBeenCalledWith('/characters/ch1?mode=create')
    // O template mais recente do sistema da crônica
    expect(calls.templateGet).toHaveBeenCalledWith(
      'vtm-v20',
      expect.objectContaining({ query: {} })
    )
  })

  it('Natureza e Comportamento saem da lista do livro', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(ok({ id: 'ch1' }))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'Helena')
    fireEvent.press(screen.getByTestId('suggest-nature'))
    fireEvent.press(screen.getByRole('button', { name: 'Arquiteto' }))
    // O texto continua livre
    fireEvent.changeText(screen.getByTestId('editor-demeanor'), 'Galã')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(calls.chronicle.charactersPost).toHaveBeenCalledWith({
      values: { name: 'Helena', nature: 'Arquiteto', demeanor: 'Galã' },
      clientCommandId: expect.any(String),
    })
  })

  // T-60: a lista na ordem do rótulo em português, não na do livro em inglês
  it('as sugestões da Natureza vêm na ordem do rótulo', async () => {
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.press(await screen.findByTestId('suggest-nature'))
    const list = within(screen.getByTestId('suggest-nature-list'))
    const names = list
      .getAllByRole('button')
      .map(b => String(b.props.accessibilityLabel ?? ''))
    expect(names.slice(0, 5)).toEqual([
      'Arquiteto',
      'Autocrata',
      'Bon Vivant',
      'Caçador de Emoções',
      'Camaleão',
    ])
    expect(names.slice(-3)).toEqual(['Trapaceiro', 'Valentão', 'Visionário'])
  })

  // T-21: o erro fica fora da tela; a tela rola até o campo e o foca
  it('Criar ficha sem nome rola até o Nome e o foca', async () => {
    const { ScrollView, TextInput } = jest.requireActual('react-native')
    const scrollTo = jest.mocked(ScrollView.prototype.scrollTo)
    const focus = jest.mocked(TextInput.prototype.focus)
    scrollTo.mockClear()
    focus.mockClear()
    renderWithSession(<NewCharacterScreen />, await signedIn())
    const layout = (testID: string, y: number) =>
      fireEvent(screen.getByTestId(testID), 'layout', {
        nativeEvent: { layout: { x: 0, y, width: 360, height: 400 } },
      })
    await screen.findByTestId('new-character-form')
    layout('new-character-form', 64)
    layout('form-row-name', 0)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(calls.chronicle.charactersPost).not.toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalledWith({ y: 48, animated: true })
    expect(
      (focus.mock.contexts as { props: { testID?: string } }[]).map(
        c => c.props.testID
      )
    ).toEqual(['editor-name'])
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome')
  })

  it('422 do servidor marca o campo', async () => {
    calls.chronicle.charactersPost.mockResolvedValue({
      data: null,
      error: {
        status: 422,
        value: {
          error: 'ficha inválida',
          issues: [{ path: '/values/name', message: 'informe o nome' }],
        },
      },
    })
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'X')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('informe o nome')
  })

  it('outro erro aparece como faixa', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(
      fail(422, 'limite de fichas nesta crônica')
    )
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'X')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'limite de fichas nesta crônica'
    )
  })

  // L-02: a tela tem saída (no app, "Voltar"; no web, "Recarregar")
  it('template desconhecido: "Atualize o app" com "Voltar", sem loja configurada', async () => {
    const t = templateJson('vtm-v20')
    t.schema = 2
    calls.templateGet.mockResolvedValue(ok(t))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Atualize o app' })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Abrir a loja' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(router.back).toHaveBeenCalled()
  })

  it('template desconhecido no web: "Recarregue a página" e "Recarregar"', async () => {
    const t = templateJson('vtm-v20')
    t.schema = 2
    calls.templateGet.mockResolvedValue(ok(t))
    const reload = jest.fn()
    const page = globalThis as { location?: unknown }
    const location = page.location
    const os = Platform.OS
    page.location = { reload }
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
      renderWithSession(<NewCharacterScreen />, await signedIn())
      expect(
        await screen.findByRole('header', { name: 'Recarregue a página' })
      ).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Recarregar' }))
      expect(reload).toHaveBeenCalled()
    } finally {
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
      page.location = location
    }
  })

  it('crônica inacessível, com "Tentar de novo"', async () => {
    calls.chronicle.get.mockResolvedValue(fail(404, 'não encontrado'))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    expect(
      await screen.findByRole('header', {
        name: 'Não foi possível abrir a criação de ficha',
      })
    ).toBeTruthy()
    const before = calls.chronicle.get.mock.calls.length
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    })
    expect(calls.chronicle.get.mock.calls.length).toBeGreaterThan(before)
  })
})

// L-03: criar confirma "Ficha criada." antes de abrir a ficha; se a ficha
// não abrir, a pessoa sabe que ela existe e não cria outra igual
// T-29: a Nova ficha diz o modo em que a ficha vai abrir e o orçamento
// R-19 (IA-06): na Nova ficha, o "?" do Clã (o título do grupo e cada clã) e
// o da Natureza, com as frases do template; o nome dos rádios não muda.
describe('Nova ficha: o "?" da ajuda', () => {
  it('Clã e Natureza têm "?", com a frase do template', async () => {
    const t = templateJson('vtm-v20') as {
      fields: Record<
        string,
        { help?: string; options?: { id: string; help?: string }[] }
      >
    }
    renderWithSession(<NewCharacterScreen />, await signedIn())
    await screen.findByTestId('editor-name')
    expect(screen.getByRole('radio', { name: 'Brujah' })).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Ajuda: Brujah' }))
    const brujah = t.fields.clan?.options?.find(o => o.id === 'brujah')
    expect(screen.getByText(brujah?.help ?? '-')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Ajuda: Clã' }))
    expect(screen.getByText(t.fields.clan?.help ?? '-')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Ajuda: Natureza' }))
    expect(screen.getByText(t.fields.nature?.help ?? '-')).toBeTruthy()
    // A frase não fica mais como dica sempre visível do campo
    expect(
      screen.getByTestId('editor-nature').props.accessibilityHint
    ).toBeUndefined()
  })
})

// U-06 (D-12): no Mago, "Casa ou subgrupo" com "Opcional" e o "?" da frase;
// uma Verbena sem Casa é criada. Nada é exigido além do Nome.
describe('Nova ficha do Mago: Casa ou subgrupo', () => {
  beforeEach(() => {
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'A Torre',
        system: { code: 'mta-m20', name: 'Mago: A Ascensão' },
        role: 'player',
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
      })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('mta-m20')))
  })

  it('o campo diz "Opcional", tem o "?" e não é exigido', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(ok({ id: 'ch1' }))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    const house = await screen.findByTestId('editor-house')
    expect(house.props.accessibilityLabel).toBe('Casa ou subgrupo')
    expect(house.props.placeholder).toBe('Opcional')
    fireEvent.press(
      screen.getByRole('button', { name: 'Ajuda: Casa ou subgrupo' })
    )
    expect(screen.getByText(/É opcional/)).toBeTruthy()
    fireEvent.changeText(screen.getByTestId('editor-name'), 'Iara Lune')
    fireEvent.press(screen.getByRole('radio', { name: 'Verbena' }))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(calls.chronicle.charactersPost).toHaveBeenCalledWith({
      values: { name: 'Iara Lune', tradition: 'verbena' },
      clientCommandId: expect.any(String),
    })
  })
})

describe('Nova ficha: modo e orçamento da crônica', () => {
  const chronicleWith = (
    creation?: { approval: boolean; defaults: unknown },
    role = 'player'
  ) =>
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'Crônica da Liberdade',
        system: VTM,
        role,
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
        ...(creation && { creation: { ...creation, revision: 1 } }),
      })
    )
  const intro = async () =>
    (await screen.findByTestId('new-character-intro')).props.children

  it('por pontos: o orçamento, o modo Criação e a aprovação', async () => {
    chronicleWith({ approval: true, defaults: { freebies: 21 } })
    renderWithSession(<NewCharacterScreen />, await signedIn())
    expect(await intro()).toBe(
      'Esta crônica usa criação por pontos: Atributos 7/5/3 · Habilidades 13/9/5 · Disciplinas 3 · Antecedentes 5 · Virtudes 7 · 21 de bônus. Comece pela identidade; os pontos você distribui depois, na ficha, no modo Criação. O narrador aprova a ficha antes de ela entrar em jogo.'
    )
  })

  it('livre: o modo Editar e quem conclui', async () => {
    chronicleWith({ approval: false, defaults: { mode: 'free' } })
    renderWithSession(<NewCharacterScreen />, await signedIn())
    const text = await intro()
    expect(text).toMatch(/criação livre/)
    expect(text).toMatch(/no modo Editar/)
    expect(text).toMatch(/O narrador conclui a criação\.$/)
  })

  it('sem as regras da crônica, o texto de antes (nunca "criação livre")', async () => {
    chronicleWith(undefined)
    renderWithSession(<NewCharacterScreen />, await signedIn())
    expect(await intro()).toBe(
      'Comece pela identidade. Atributos, habilidades e poderes você monta depois, na ficha.'
    )
  })

  it('o NPC não muda', async () => {
    chronicleWith({ approval: true, defaults: {} }, 'storyteller')
    jest
      .mocked(useLocalSearchParams)
      .mockReturnValue({ id: CHRONICLE, kind: 'npc' })
    renderWithSession(<NewCharacterScreen />, await signedIn())
    expect(await intro()).toMatch(/^O NPC nasce oculto e em criação livre/)
  })

  it('na crônica, o jogador vê a linha sob "Suas fichas"; o narrador, não', async () => {
    chronicleWith({ approval: false, defaults: {} })
    calls.chronicle.charactersGet.mockResolvedValue(ok([]))
    const session = await signedIn()
    const first = renderWithSession(<ChronicleScreen />, session)
    expect((await screen.findByTestId('creation-summary')).props.children).toBe(
      'Criação por pontos · Atributos 7/5/3 · Habilidades 13/9/5 · Disciplinas 3 · Antecedentes 5 · Virtudes 7 · 15 de bônus · aprovação desligada'
    )
    first.unmount()
    chronicleWith({ approval: false, defaults: {} }, 'storyteller')
    renderWithSession(<ChronicleScreen />, session)
    await screen.findByRole('header', { name: 'Fichas' })
    expect(screen.queryByTestId('creation-summary')).toBeNull()
  })
})

describe('Nova ficha: confirmação ao criar', () => {
  it('mostra "Ficha criada." e abre a ficha', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(ok({ id: 'ch1' }))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(
      await screen.findByTestId('editor-name'),
      'Helena Varga'
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(await screen.findByText('Ficha criada.')).toBeTruthy()
    expect(router.replace).toHaveBeenCalledWith('/characters/ch1?mode=create')
  })

  it('erro ao criar não confirma nada', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(
      fail(422, 'limite de fichas nesta crônica')
    )
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'X')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByText('Ficha criada.')).toBeNull()
    expect(router.replace).not.toHaveBeenCalled()
  })
})

// T-02: dois toques em "Criar ficha" criavam duas fichas
describe('Nova ficha: um pedido por intenção', () => {
  const keyOf = (call: number) =>
    (
      calls.chronicle.charactersPost.mock.calls[call]?.[0] as
        | { clientCommandId?: string }
        | undefined
    )?.clientCommandId

  it('dois toques seguidos antes da resposta mandam um POST, com a chave', async () => {
    let answer: (value: unknown) => void = () => undefined
    calls.chronicle.charactersPost.mockReturnValue(
      new Promise(resolve => {
        answer = resolve
      })
    )
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'Isadora')
    const button = screen.getByRole('button', { name: 'Criar ficha' })
    await act(async () => {
      fireEvent.press(button)
      fireEvent.press(button)
    })
    expect(calls.chronicle.charactersPost).toHaveBeenCalledTimes(1)
    expect(keyOf(0)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    await act(async () => {
      answer(ok({ id: 'ch1' }))
    })
    expect(router.replace).toHaveBeenCalledTimes(1)
  })

  it('depois de erro de rede a nova tentativa usa a mesma chave; depois de 422, outra', async () => {
    calls.chronicle.charactersPost
      .mockResolvedValueOnce({
        data: null,
        error: { status: 0, value: new TypeError('Network request failed') },
      })
      .mockResolvedValueOnce(fail(422, 'limite de fichas nesta crônica'))
      .mockResolvedValueOnce(ok({ id: 'ch1' }))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'Isadora')
    for (let i = 0; i < 3; i++)
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
      })
    expect(calls.chronicle.charactersPost).toHaveBeenCalledTimes(3)
    expect(keyOf(1)).toBe(keyOf(0))
    expect(keyOf(2)).not.toBe(keyOf(1))
    expect(router.replace).toHaveBeenCalledWith('/characters/ch1?mode=create')
  })
})

// T-56 (QAW-11, QAA-23): voltar, F5 ou o Voltar do Android descartavam o
// formulário preenchido sem perguntar
describe('Nova ficha: guarda de saída', () => {
  const last = () => {
    const all = jest.mocked(usePreventRemove).mock.calls
    return all[all.length - 1]
  }
  const tryLeave = (repeat: jest.Mock) =>
    act(() => {
      last()?.[1]?.({ data: { action: { type: 'GO_BACK' } }, repeat } as never)
    })

  it('formulário preenchido segura a saída com "Sair sem salvar?"', async () => {
    renderWithSession(<NewCharacterScreen />, await signedIn())
    const name = await screen.findByTestId('editor-name')
    expect(last()?.[0]).toBe(false)
    fireEvent.changeText(name, '   ')
    expect(last()?.[0]).toBe(false)
    fireEvent.changeText(name, 'Isadora')
    expect(last()?.[0]).toBe(true)
    const repeat = jest.fn()
    tryLeave(repeat)
    expect(screen.getByText('Sair sem salvar?')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Descartar e sair' }))
    // A saída vem depois que a folha sai da tela (onClosed, P03-D)
    await sheetsDismissed()
    expect(repeat).toHaveBeenCalledTimes(1)
  })

  it('depois de criar, a ida para a ficha nova passa direto', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(ok({ id: 'ch1' }))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'Isadora')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(router.replace).toHaveBeenCalledWith('/characters/ch1?mode=create')
    // O replace remove a tela: a guarda deixa passar sem perguntar
    const repeat = jest.fn()
    tryLeave(repeat)
    expect(repeat).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Sair sem salvar?')).toBeNull()
  })
})

describe('Fichas na crônica', () => {
  it('lista com selo e resumo do core e leva à ficha', async () => {
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        {
          id: 'ch1',
          name: 'Helena Varga',
          mine: true,
          owner: { id: 'u2', username: 'dona' },
          templateVersion: '1.0.0',
          updatedAt: '',
          values: {
            name: 'Helena Varga',
            clan: 'tremere',
            concept: 'Arquivista',
            backgrounds: [{ id: 'b1', name: 'Geração', value: 5 }],
          },
        },
        {
          id: 'ch2',
          name: 'Caio',
          mine: false,
          owner: { id: 'u3', username: 'beto' },
          templateVersion: '1.0.0',
          updatedAt: '',
          values: { name: 'Caio' },
        },
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Suas fichas' })
    ).toBeTruthy()
    const mine = await screen.findByRole('button', {
      name: 'Helena Varga, Arquivista · 8ª geração, Tremere · Sua ficha',
    })
    // A API não manda a ficha de outro jogador; se mandasse, o app não mostra
    expect(screen.queryByRole('button', { name: /^Caio, / })).toBeNull()
    fireEvent.press(mine)
    expect(router.push).toHaveBeenCalledWith('/characters/ch1')
    fireEvent.press(screen.getByRole('button', { name: 'Nova ficha' }))
    expect(router.push).toHaveBeenCalledWith(
      `/chronicles/${CHRONICLE}/new-character`
    )
  })

  it('o narrador vê a ficha que aguarda a revisão dele', async () => {
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'Crônica da Liberdade',
        system: VTM,
        role: 'storyteller',
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
      })
    )
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        {
          id: 'ch1',
          name: 'Helena Varga',
          mine: false,
          owner: { id: 'u2', username: 'dona' },
          status: 'pending',
          templateVersion: '1.0.0',
          updatedAt: '',
          values: { name: 'Helena Varga' },
        },
        {
          id: 'ch2',
          name: 'Caio',
          mine: false,
          owner: { id: 'u3', username: 'beto' },
          status: 'active',
          templateVersion: '1.0.0',
          updatedAt: '',
          values: { name: 'Caio' },
        },
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(await screen.findByText('1 ficha aguarda sua revisão')).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: /^Helena Varga, .*de dona, Aguardando aprovação$/,
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^Caio, .*de beto$/ })
    ).toBeTruthy()
  })

  // T-06: a ficha devolvida volta à lista com o estado, sem o motivo
  const row = (over: Record<string, unknown>) => ({
    id: 'ch1',
    name: 'Helena Varga',
    mine: true,
    owner: { id: 'u2', username: 'dona' },
    templateVersion: '1.0.0',
    updatedAt: '',
    values: { name: 'Helena Varga' },
    ...over,
  })

  it('a dona vê "Sua ficha, Devolvida"; "Aguardando aprovação" no selo', async () => {
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        row({ status: 'creating', returned: true }),
        row({ id: 'ch2', name: 'Caio', status: 'pending' }),
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('button', {
        name: /^Helena Varga, .*Sua ficha, Devolvida$/,
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: /^Caio, .*Sua ficha, Aguardando aprovação$/,
      })
    ).toBeTruthy()
  })

  it('o narrador vê "de <jogador>, Devolvida"', async () => {
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'Crônica da Liberdade',
        system: VTM,
        role: 'storyteller',
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
      })
    )
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([row({ mine: false, status: 'creating', returned: true })])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('button', {
        name: /^Helena Varga, .*de dona, Devolvida$/,
      })
    ).toBeTruthy()
  })

  // P04-D (R-12): o estado vai no selo, sob o meta, e entra no nome
  it('a linha diz o estado: em criação por pontos, ajuste pedido e concluída', async () => {
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        row({ status: 'creating', creationMode: 'points' }),
        row({
          id: 'ch2',
          name: 'Caio',
          status: 'creating',
          creationMode: 'free',
          adjust: true,
        }),
        row({
          id: 'ch3',
          name: 'Dora',
          status: 'active',
          activatedAt: '2026-11-01T12:00:00Z',
        }),
        // A trava vence a data, como na Mesa (achado do /code-review)
        row({
          id: 'ch4',
          name: 'Eva',
          status: 'active',
          activatedAt: '2026-11-01T12:00:00Z',
          lockedAt: '2026-11-02T12:00:00Z',
        }),
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('button', {
        name: /^Helena Varga, .*Sua ficha, Em criação · por pontos$/,
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: /^Caio, .*Sua ficha, Aguardando ajuste$/,
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: /^Dora, .*Sua ficha, Concluída em 01\/11$/,
      })
    ).toBeTruthy()
    expect(screen.getByTestId('character-state-ch1')).toHaveTextContent(
      'Em criação · por pontos'
    )
    expect(
      screen.getByRole('button', { name: /^Eva, .*Sua ficha, Travada$/ })
    ).toBeTruthy()
  })

  // P04-D (R-13): na criação livre, o narrador vê quem avisou que terminou
  it('o narrador vê o banner de quem avisou que terminou', async () => {
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'Crônica da Liberdade',
        system: VTM,
        role: 'storyteller',
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
      })
    )
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        row({
          mine: false,
          status: 'creating',
          creationMode: 'free',
          ready: true,
        }),
        // A ficha do próprio narrador não entra no aviso
        row({
          id: 'ch2',
          name: 'Da narradora',
          mine: true,
          status: 'creating',
          creationMode: 'free',
          ready: true,
        }),
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByText('1 jogador avisou que terminou')
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Helena Varga: abra a ficha para concluir a criação ou pedir ajuste.'
      )
    ).toBeTruthy()
    expect(screen.getByTestId('ready-review')).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: /^Helena Varga, .*de dona, Avisou que terminou$/,
      })
    ).toBeTruthy()
  })

  it('o NPC do narrador diz "NPC" e a visibilidade, nunca "Sua ficha" (T-52)', async () => {
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'Crônica da Liberdade',
        system: VTM,
        role: 'storyteller',
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
      })
    )
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        row({
          id: 'n1',
          name: 'Figura Velada',
          kind: 'npc',
          visibility: 'hidden',
          owner: { id: 'u1', username: 'ana' },
          values: { name: 'Figura Velada', clan: 'tremere' },
        }),
        row({
          id: 'n2',
          name: 'Oráculo',
          kind: 'npc',
          visibility: 'full',
          owner: { id: 'u1', username: 'ana' },
          values: { name: 'Oráculo' },
        }),
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('button', {
        name: /^Figura Velada, .*Tremere · NPC, Oculto$/,
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^Oráculo, .*NPC, Ficha revelada$/ })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Sua ficha/ })).toBeNull()
  })

  it('o jogador vê "NPC revelado", sem a visibilidade (T-52)', async () => {
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        {
          projection: 'identity',
          id: 'n1',
          kind: 'npc',
          visibility: 'full',
          identity: {
            name: 'Figura Velada',
            chip: 'Tremere',
            subtitle: null,
            portraitUrl: null,
          },
        },
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('button', {
        name: /^Figura Velada, .*NPC revelado$/,
      })
    ).toBeTruthy()
    expect(
      screen.queryByText(/Oculto|Identidade revelada|Ficha revelada/)
    ).toBeNull()
  })

  it('voltar à crônica rebusca a lista', async () => {
    const focus: (() => void)[] = []
    jest.mocked(useFocusEffect).mockImplementation(effect => {
      focus.push(effect as () => void)
    })
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([row({ status: 'pending' })])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    await screen.findByRole('button', { name: /Aguardando aprovação$/ })
    const before = calls.chronicle.charactersGet.mock.calls.length
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([row({ status: 'creating', returned: true })])
    )
    await act(async () => {
      for (const f of focus) f()
    })
    await waitFor(() =>
      expect(calls.chronicle.charactersGet.mock.calls.length).toBeGreaterThan(
        before
      )
    )
    expect(
      await screen.findByRole('button', { name: /Sua ficha, Devolvida$/ })
    ).toBeTruthy()
  })

  it('sem fichas e com erro', async () => {
    calls.chronicle.charactersGet.mockResolvedValueOnce(ok([]))
    const session = await signedIn()
    const first = renderWithSession(<ChronicleScreen />, session)
    expect(
      await screen.findByText('Você ainda não tem ficha nesta crônica.')
    ).toBeTruthy()
    first.unmount()
    calls.chronicle.charactersGet.mockResolvedValue(fail(500, 'erro interno'))
    renderWithSession(<ChronicleScreen />, session)
    expect(await screen.findByText('erro interno')).toBeTruthy()
  })
})
