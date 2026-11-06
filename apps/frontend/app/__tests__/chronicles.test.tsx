import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { FlatList, Platform, Share } from 'react-native'

import * as apiModule from '../../lib/api'
import { WEB_URL } from '../../lib/env'
import * as focusModule from '../../lib/focus'
import {
  clearPendingInvite,
  peekPendingInvite,
  setPendingInvite,
} from '../../lib/invite/pending'
import { createMemoryDraftStore } from '../../sheet/sync/draftStore'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen from '../(app)/chronicles/[id]/index'
import NewChronicleScreen from '../(app)/chronicles/new'
import ChroniclesScreen from '../(app)/index'
import JoinScreen from '../(app)/join'

// A fábrica do jest.mock roda antes dos imports: o Eden falso nasce nela
jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
// Uma chave de verdade por intenção (T-02)
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))

const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(),
}
const VTM = {
  code: 'vtm-v20',
  name: 'Vampiro: A Máscara — Edição de 20º Aniversário',
  family: 'wod',
}
const CHRONICLE_ID = '00000000-0000-4000-8000-0000000000c1'

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await session.restore()
  return session
}

describe('Crônicas (lista)', () => {
  it('mostra papel, narrador e número de personagens', async () => {
    calls.chroniclesGet.mockResolvedValue(
      ok([
        {
          id: CHRONICLE_ID,
          name: 'Crônica da Liberdade',
          system: VTM,
          role: 'storyteller',
          storyteller: { username: 'ana' },
          characterCount: 3,
        },
        {
          id: 'c2',
          name: 'Noites de São Paulo',
          system: VTM,
          role: 'player',
          storyteller: { username: 'beto' },
          characterCount: 1,
        },
      ])
    )
    renderWithSession(<ChroniclesScreen />, await signedIn())
    const mine = await screen.findByRole('button', {
      name: `Crônica da Liberdade, ${VTM.name}, Você narra · 3 personagens`,
    })
    expect(
      screen.getByRole('button', {
        name: `Noites de São Paulo, ${VTM.name}, Narrador: beto · 1 personagem`,
      })
    ).toBeTruthy()
    fireEvent.press(mine)
    expect(router.push).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
  })

  // T-40 (P09-C): a lista rebusca ao ganhar foco e ao puxar; o
  // "aguarda revisão" acompanha
  it('rebusca no foco e ao puxar, com o indicador só durante o puxão', async () => {
    const focus: (() => void)[] = []
    jest.mocked(useFocusEffect).mockImplementation(cb => {
      focus.push(cb as () => void)
    })
    try {
      const list = (pendingReview: number) =>
        ok([
          {
            id: CHRONICLE_ID,
            name: 'Crônica da Liberdade',
            system: VTM,
            role: 'storyteller',
            storyteller: { username: 'ana' },
            characterCount: 3,
            pendingReview,
          },
        ])
      calls.chroniclesGet.mockResolvedValue(list(1))
      renderWithSession(<ChroniclesScreen />, await signedIn())
      expect(
        await screen.findByRole('button', {
          name: `Crônica da Liberdade, ${VTM.name}, Você narra · 3 personagens · 1 ficha aguarda revisão`,
        })
      ).toBeTruthy()
      // Aprovada em outra tela: a volta à lista traz o número atual
      calls.chroniclesGet.mockResolvedValue(list(0))
      const before = calls.chroniclesGet.mock.calls.length
      act(() => {
        focus.at(-1)?.()
      })
      expect(
        await screen.findByRole('button', {
          name: `Crônica da Liberdade, ${VTM.name}, Você narra · 3 personagens`,
        })
      ).toBeTruthy()
      expect(calls.chroniclesGet.mock.calls.length).toBe(before + 1)
      // Puxar: refreshing liga até a resposta e desliga depois
      let resolve: (v: unknown) => void = () => undefined
      calls.chroniclesGet.mockImplementation(
        () => new Promise(r => (resolve = r))
      )
      const flat = screen.UNSAFE_getByType(FlatList)
      expect(flat.props.refreshing).toBe(false)
      let pulled: Promise<void> | undefined
      act(() => {
        pulled = flat.props.onRefresh()
      })
      expect(screen.UNSAFE_getByType(FlatList).props.refreshing).toBe(true)
      await act(async () => {
        resolve(list(2))
        await pulled
      })
      expect(screen.UNSAFE_getByType(FlatList).props.refreshing).toBe(false)
      expect(
        await screen.findByRole('button', {
          name: `Crônica da Liberdade, ${VTM.name}, Você narra · 3 personagens · 2 fichas aguardam revisão`,
        })
      ).toBeTruthy()
    } finally {
      jest.mocked(useFocusEffect).mockReset()
    }
  })

  it('mostra a última sessão como data civil, sem fuso (U-04)', async () => {
    calls.chroniclesGet.mockResolvedValue(
      ok([
        {
          id: CHRONICLE_ID,
          name: 'Crônica da Liberdade',
          system: VTM,
          role: 'player',
          storyteller: { username: 'ana' },
          characterCount: 1,
          lastSession: '2026-11-01',
        },
        {
          id: 'c2',
          name: 'Noites de São Paulo',
          system: VTM,
          role: 'player',
          storyteller: { username: 'beto' },
          characterCount: 1,
          lastSession: null,
        },
      ])
    )
    renderWithSession(<ChroniclesScreen />, await signedIn())
    expect(
      await screen.findByRole('button', {
        name: `Crônica da Liberdade, ${VTM.name}, Narrador: ana · 1 personagem · Última sessão: 01/11`,
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: `Noites de São Paulo, ${VTM.name}, Narrador: beto · 1 personagem`,
      })
    ).toBeTruthy()
  })

  it('a proposta de narrar aparece para quem a recebeu, com as duas ações (U-03)', async () => {
    const TRANSFER = '00000000-0000-4000-8000-0000000000f1'
    calls.chroniclesGet.mockResolvedValue(
      ok([
        {
          id: CHRONICLE_ID,
          name: 'Crônica da Liberdade',
          system: VTM,
          role: 'player',
          storyteller: { username: 'ana' },
          characterCount: 1,
          transferOffer: { id: TRANSFER, expiresAt: '2026-11-08T12:00:00Z' },
        },
        {
          id: 'c2',
          name: 'Noites de São Paulo',
          system: VTM,
          role: 'player',
          storyteller: { username: 'beto' },
          characterCount: 1,
          transferOffer: null,
        },
      ])
    )
    calls.chronicle.transferDecision.mockResolvedValue(
      ok({ status: 'rejected', duplicate: false })
    )
    renderWithSession(<ChroniclesScreen />, await signedIn())
    expect(
      await screen.findByText('Convite para narrar Crônica da Liberdade')
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: `Crônica da Liberdade, ${VTM.name}, Narrador: ana · 1 personagem · Convite para narrar`,
      })
    ).toBeTruthy()
    // Uma proposta, um aviso
    expect(
      screen.getAllByRole('button', { name: 'Aceitar narração' })
    ).toHaveLength(1)

    // Recusar manda a chave e rebusca a lista: o aviso some
    calls.chroniclesGet.mockResolvedValue(
      ok([
        {
          id: CHRONICLE_ID,
          name: 'Crônica da Liberdade',
          system: VTM,
          role: 'player',
          storyteller: { username: 'ana' },
          characterCount: 1,
          transferOffer: null,
        },
      ])
    )
    fireEvent.press(screen.getByRole('button', { name: 'Recusar' }))
    await waitFor(() =>
      expect(calls.chronicle.transferDecision).toHaveBeenCalledWith(
        CHRONICLE_ID,
        TRANSFER,
        'reject',
        expect.objectContaining({ clientCommandId: expect.any(String) })
      )
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Aceitar narração' })
      ).toBeNull()
    )
  })

  it('vazio: criar ou entrar com convite', async () => {
    calls.chroniclesGet.mockResolvedValue(ok([]))
    renderWithSession(<ChroniclesScreen />, await signedIn())
    expect(
      await screen.findByRole('header', {
        name: 'Você ainda não participa de nenhuma crônica',
      })
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
    fireEvent.press(screen.getByRole('button', { name: 'Entrar com convite' }))
    expect(router.push.mock.calls).toEqual([['/chronicles/new'], ['/join']])
  })

  it('erro: mensagem e tentar de novo', async () => {
    calls.chroniclesGet.mockResolvedValueOnce(fail(500, 'erro interno'))
    calls.chroniclesGet.mockResolvedValueOnce(ok([]))
    renderWithSession(<ChroniclesScreen />, await signedIn())
    expect(await screen.findByText('erro interno')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('header', {
        name: 'Você ainda não participa de nenhuma crônica',
      })
    ).toBeTruthy()
  })

  it('"Conta" abre a tela da conta', async () => {
    calls.chroniclesGet.mockResolvedValue(ok([]))
    renderWithSession(<ChroniclesScreen />, await signedIn())
    fireEvent.press(screen.getByRole('button', { name: 'Conta' }))
    expect(router.push).toHaveBeenCalledWith('/account')
  })

  it('sair encerra a sessão', async () => {
    calls.chroniclesGet.mockResolvedValue(ok([]))
    const session = await signedIn()
    renderWithSession(<ChroniclesScreen />, session)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
    })
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
  })
})

// P03-C (T-03): o rascunho guardado também entra no aviso de "Sair"
describe('Crônicas: sair com rascunho guardado', () => {
  it('pergunta antes de descartar o rascunho', async () => {
    calls.chroniclesGet.mockResolvedValue(ok([]))
    const drafts = createMemoryDraftStore()
    await drafts.write({
      v: 1,
      characterId: '00000000-0000-4000-8000-00000000c001',
      templateVersion: '1.0.0',
      baseVersion: 1,
      mode: 'create',
      savedAt: Date.now(),
      edits: [{ path: 'values.strength', from: 1, to: 3 }],
    })
    const session = await signedIn()
    renderWithSession(<ChroniclesScreen />, session, { drafts })
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
    })
    expect(
      await screen.findByText(
        'O rascunho não salvo de 1 ficha será descartado neste aparelho.'
      )
    ).toBeTruthy()
    expect(session.getState().status).toBe('signedIn')
  })
})

describe('Nova crônica', () => {
  it('com um sistema só, ele já vem escolhido; criar abre a crônica', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    calls.chroniclesPost.mockResolvedValue(
      ok({
        id: CHRONICLE_ID,
        name: 'Liberdade',
        system: VTM,
        role: 'storyteller',
      })
    )
    renderWithSession(<NewChronicleScreen />, await signedIn())
    const radio = await screen.findByRole('radio', { name: VTM.name })
    expect(radio).toBeChecked()
    fireEvent.changeText(screen.getByTestId('chronicle-name'), '  Liberdade ')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
    })
    expect(calls.chroniclesPost).toHaveBeenCalledWith({
      name: 'Liberdade',
      systemCode: 'vtm-v20',
      clientCommandId: expect.any(String),
    })
    expect(router.replace).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
  })

  it('sem nome, avisa e não chama a API', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: VTM.name })
    fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
    expect(screen.getByText('Dê um nome à crônica')).toBeTruthy()
    expect(calls.chroniclesPost).not.toHaveBeenCalled()
  })

  it('erro da API aparece como alerta', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    calls.chroniclesPost.mockResolvedValue(fail(400, 'dados inválidos'))
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: VTM.name })
    fireEvent.changeText(screen.getByTestId('chronicle-name'), '<b>x</b>')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'dados inválidos'
    )
  })

  // T-02: dois toques em "Criar crônica" criavam duas crônicas
  it('dois toques seguidos antes da resposta mandam um POST, com a chave', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    let answer: (value: unknown) => void = () => undefined
    calls.chroniclesPost.mockReturnValue(
      new Promise(resolve => {
        answer = resolve
      })
    )
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: VTM.name })
    fireEvent.changeText(screen.getByTestId('chronicle-name'), 'Liberdade')
    const button = screen.getByRole('button', { name: 'Criar crônica' })
    await act(async () => {
      fireEvent.press(button)
      fireEvent.press(button)
    })
    expect(calls.chroniclesPost).toHaveBeenCalledTimes(1)
    await act(async () => {
      answer(
        ok({
          id: CHRONICLE_ID,
          name: 'Liberdade',
          system: VTM,
          role: 'storyteller',
        })
      )
    })
    expect(router.replace).toHaveBeenCalledTimes(1)
  })

  it('504 do proxy: a nova tentativa usa a mesma chave', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    calls.chroniclesPost
      .mockResolvedValueOnce(fail(504, 'Gateway Timeout'))
      .mockResolvedValueOnce(
        ok({
          id: CHRONICLE_ID,
          name: 'Liberdade',
          system: VTM,
          role: 'storyteller',
        })
      )
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: VTM.name })
    fireEvent.changeText(screen.getByTestId('chronicle-name'), 'Liberdade')
    for (let i = 0; i < 2; i++)
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
      })
    const keys = calls.chroniclesPost.mock.calls.map(
      c => (c[0] as { clientCommandId: string }).clientCommandId
    )
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
  })

  it('depois de erro de rede a nova tentativa usa a mesma chave; depois de recusa, outra', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    calls.chroniclesPost
      .mockResolvedValueOnce({
        data: null,
        error: { status: 0, value: new TypeError('Network request failed') },
      })
      .mockResolvedValueOnce(fail(400, 'dados inválidos'))
      .mockResolvedValueOnce(
        ok({
          id: CHRONICLE_ID,
          name: 'Liberdade',
          system: VTM,
          role: 'storyteller',
        })
      )
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: VTM.name })
    fireEvent.changeText(screen.getByTestId('chronicle-name'), 'Liberdade')
    for (let i = 0; i < 3; i++)
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
      })
    const keys = calls.chroniclesPost.mock.calls.map(
      c => (c[0] as { clientCommandId: string }).clientCommandId
    )
    expect(keys).toHaveLength(3)
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[1])
  })

  it('com vários sistemas, escolher antes de criar', async () => {
    calls.systemsGet.mockResolvedValue(
      ok([VTM, { code: 'mta-m20', name: 'Mago', family: 'wod' }])
    )
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: 'Mago' })
    expect(screen.getByRole('button', { name: 'Criar crônica' })).toBeDisabled()
    fireEvent.press(screen.getByRole('radio', { name: 'Mago' }))
    expect(screen.getByRole('button', { name: 'Criar crônica' })).toBeEnabled()
  })
})

describe('Entrar com convite', () => {
  it('entra e abre a crônica', async () => {
    calls.acceptPost.mockResolvedValue(
      ok({ chronicleId: CHRONICLE_ID, role: 'player' })
    )
    renderWithSession(<JoinScreen />, await signedIn())
    fireEvent.changeText(screen.getByTestId('invite-code'), ' abcd efgh ')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar na crônica' }))
    })
    expect(calls.acceptPost).toHaveBeenCalledWith({ code: 'abcd efgh' })
    expect(router.replace).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
  })

  it('código inválido: mensagem genérica', async () => {
    calls.acceptPost.mockResolvedValue(
      fail(404, 'convite inválido ou expirado')
    )
    renderWithSession(<JoinScreen />, await signedIn())
    fireEvent.changeText(screen.getByTestId('invite-code'), 'XXXX')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar na crônica' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'convite inválido ou expirado'
    )
  })
})

// P12, D-14: o link preenche o campo; o aceite continua no toque
describe('Entrar com convite pelo link', () => {
  const CODE = 'ABCD2345EFGH6789JKMN0PQRST'
  afterEach(() => clearPendingInvite())

  it('campo preenchido, a conta dita, nada enviado até o toque', async () => {
    setPendingInvite(CODE)
    calls.acceptPost.mockResolvedValue(
      ok({ chronicleId: CHRONICLE_ID, role: 'player' })
    )
    const session = await signedIn()
    renderWithSession(<JoinScreen />, session)
    expect(screen.getByTestId('invite-code').props.value).toBe(CODE)
    const username = session.getState().user?.username ?? ''
    expect(
      screen.getByText(`Convite recebido. Você vai entrar como ${username}.`)
    ).toBeTruthy()
    expect(calls.acceptPost).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar na crônica' }))
    })
    expect(calls.acceptPost).toHaveBeenCalledWith({ code: CODE })
    expect(peekPendingInvite()).toBeNull()
    expect(router.replace).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
  })

  it('um link novo com a tela aberta troca o código', async () => {
    renderWithSession(<JoinScreen />, await signedIn())
    expect(screen.getByTestId('invite-code').props.value).toBe('')
    act(() => setPendingInvite(CODE))
    expect(screen.getByTestId('invite-code').props.value).toBe(CODE)
  })

  it('o "‹" limpa o convite pendente', async () => {
    setPendingInvite(CODE)
    renderWithSession(<JoinScreen />, await signedIn())
    fireEvent.press(screen.getByRole('button', { name: /Crônicas/ }))
    expect(peekPendingInvite()).toBeNull()
  })

  it('o campo aceita até 64 caracteres, o teto do aceite', async () => {
    renderWithSession(<JoinScreen />, await signedIn())
    expect(screen.getByTestId('invite-code').props.maxLength).toBe(64)
  })
})

describe('Crônica (detalhe)', () => {
  const detail = (
    role: 'storyteller' | 'player',
    members = [{ id: 'u2', username: 'beto' }]
  ) =>
    ok({
      id: CHRONICLE_ID,
      name: 'Crônica da Liberdade',
      system: VTM,
      role,
      storyteller: { id: 'u1', username: 'ana' },
      members,
    })

  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE_ID })
  })

  it('jogador vê a mesa e não vê o convite', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Crônica da Liberdade' })
    ).toBeTruthy()
    expect(screen.getByText('Narrador: ana')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Voltar para Crônicas' })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Convidar' })).toBeNull()
    expect(calls.chronicleIds).toContain(CHRONICLE_ID)
  })

  const pendingTransfer = (available: boolean) =>
    ok({
      id: 't1',
      status: 'pending',
      recipient: { id: 'u2', username: 'beto' },
      expiresAt: '2026-11-08T00:00:00Z',
      available,
    })

  it('a proposta de narrar aparece no topo da crônica, uma vez, mesmo no Diário (U-03)', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    calls.chronicle.transferGet.mockResolvedValue(pendingTransfer(true))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(await screen.findByText('Convite para narrar')).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Aceitar narração' })
    ).toHaveLength(1)
    // Na aba Diário, continua uma só (saiu do Diário)
    fireEvent.press(screen.getByRole('tab', { name: 'Diário' }))
    await screen.findByText('Diário da crônica')
    expect(
      screen.getAllByRole('button', { name: 'Aceitar narração' })
    ).toHaveLength(1)
  })

  it('sem proposta disponível, ou para o narrador, nada no topo (U-03)', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    calls.chronicle.transferGet.mockResolvedValue(pendingTransfer(false))
    const session = await signedIn()
    const first = renderWithSession(<ChronicleScreen />, session)
    await screen.findByText('Narrador: ana')
    await waitFor(() => expect(calls.chronicle.transferGet).toHaveBeenCalled())
    expect(screen.queryByText('Convite para narrar')).toBeNull()
    first.unmount()

    calls.chronicle.transferGet.mockClear()
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    calls.chronicle.transferGet.mockResolvedValue(pendingTransfer(true))
    renderWithSession(<ChronicleScreen />, session)
    await screen.findByText('Você narra esta crônica.')
    expect(screen.queryByText('Convite para narrar')).toBeNull()
    // A consulta da proposta é do jogador; o narrador a lê nos Bastidores
    expect(calls.chronicle.transferGet).not.toHaveBeenCalled()
  })

  it('jogador não vê "Excluir crônica"', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    await screen.findByText('Narrador: ana')
    expect(screen.queryByRole('button', { name: 'Excluir crônica' })).toBeNull()
  })

  it('narrador exclui a crônica digitando o nome', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    calls.chronicle.delete.mockResolvedValue(ok(null))
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(
      await screen.findByRole('button', { name: 'Excluir crônica' })
    )
    const confirm = () =>
      screen.getAllByRole('button', { name: 'Excluir crônica' }).at(-1)
    // Sem o nome certo, o botão do sheet fica desabilitado
    expect(confirm()).toBeDisabled()
    const field = screen.getByLabelText(
      'Digite o nome da crônica para confirmar'
    )
    fireEvent.changeText(field, 'crônica da liberdade')
    expect(confirm()).toBeDisabled()
    fireEvent.changeText(field, ' Crônica da Liberdade ')
    expect(confirm()).toBeEnabled()
    await act(async () => {
      fireEvent.press(confirm() as never)
    })
    expect(calls.chronicle.delete).toHaveBeenCalledWith(CHRONICLE_ID, {
      confirm: 'Crônica da Liberdade',
    })
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('erro ao excluir aparece no sheet', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    calls.chronicle.delete.mockResolvedValue(fail(500, 'erro interno'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(
      await screen.findByRole('button', { name: 'Excluir crônica' })
    )
    fireEvent.changeText(
      screen.getByLabelText('Digite o nome da crônica para confirmar'),
      'Crônica da Liberdade'
    )
    await act(async () => {
      fireEvent.press(
        screen
          .getAllByRole('button', { name: 'Excluir crônica' })
          .at(-1) as never
      )
    })
    expect(await screen.findByText('erro interno')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalledWith('/')
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
  })

  it('crônica alheia: não encontrada', async () => {
    calls.chronicle.get.mockResolvedValue(fail(404, 'não encontrado'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Crônica não encontrada' })
    ).toBeTruthy()
  })

  it('outro erro: tentar de novo', async () => {
    calls.chronicle.get.mockResolvedValueOnce(fail(500, 'erro interno'))
    calls.chronicle.get.mockResolvedValueOnce(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(
      await screen.findByRole('button', { name: 'Tentar de novo' })
    )
    expect(await screen.findByText('Narrador: ana')).toBeTruthy()
  })

  // P12, D-14 e T-43: o convite é um link, com a mensagem pronta, e copiar
  // responde no botão e na região viva. Código fictício
  const CODE = 'ABCDEFGHJKMNPQRSTVWXYZ0123'
  const LINK = `${WEB_URL}/join#${CODE}`
  const inviteList = () =>
    ok([
      {
        id: 'i2',
        number: 3,
        createdAt: '2026-10-18T13:07:00Z',
        expiresAt: '2026-10-25T13:07:00Z',
        maxUses: 10,
        uses: 0,
        active: true,
      },
      {
        id: 'i1',
        number: 2,
        createdAt: '2026-10-18T12:00:00Z',
        expiresAt: '2026-10-25T12:00:00Z',
        maxUses: 10,
        uses: 2,
        active: true,
      },
      {
        id: 'i0',
        number: 1,
        createdAt: '2026-10-01T12:00:00Z',
        expiresAt: '2026-10-08T12:00:00Z',
        maxUses: 10,
        uses: 0,
        active: false,
      },
    ])
  const created = () =>
    ok({ id: 'i2', code: CODE, expiresAt: '2026-10-25T13:07:00Z', maxUses: 10 })

  it('narrador gera o convite, copia o link, compartilha e revoga', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller', []))
    calls.chronicle.invitesGet.mockResolvedValue(inviteList())
    calls.chronicle.invitesPost.mockResolvedValue(created())
    calls.chronicle.invitesDelete.mockResolvedValue(ok(null))
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined })
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(await screen.findByText('Você narra esta crônica.')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Convidar' }))

    expect(
      await screen.findByText(/^8 usos restantes · vale até 25\/10 às /)
    ).toBeTruthy()
    // Só os ativos aparecem
    expect(screen.queryByText(/vale até 08\/10/)).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Gerar convite' }))
    })
    expect(
      await screen.findByText('ABCD EFGH JKMN PQRS TVWX YZ01 23')
    ).toBeTruthy()
    expect(screen.getByTestId('invite-link-value')).toHaveTextContent(LINK)
    // O número vem da lista, buscada de novo depois de gerar
    expect(await screen.findByText('Convite 3')).toBeTruthy()
    // A validade e os usos vêm da resposta, não de um texto fixo
    expect(screen.getByText(/e para até 10 pessoas/)).toBeTruthy()

    jest.useFakeTimers()
    try {
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Copiar link' }))
      })
      expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(LINK)
      expect(screen.getByRole('button', { name: 'Copiado' })).toHaveTextContent(
        'Copiado ✓'
      )
      expect(screen.getByTestId('invite-copy-status')).toHaveTextContent(
        'Link copiado.'
      )
      act(() => jest.advanceTimersByTime(2000))
      expect(screen.getByRole('button', { name: 'Copiar link' })).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Copiar código' }))
    })
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(CODE)
    expect(screen.getByTestId('invite-copy-status')).toHaveTextContent(
      'Código copiado.'
    )
    // O toast de antes sai: o retorno é na folha
    expect(screen.queryByText('Código copiado')).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Compartilhar' }))
    })
    expect(share).toHaveBeenCalledWith({
      message: `Você foi convidado para a crônica "Crônica da Liberdade" no TMS. Abra o link para entrar: ${LINK} — No app TMS, toque em "Entrar com convite" e use o código ABCD EFGH JKMN PQRS TVWX YZ01 23. Vale até 25/10 e para até 10 pessoas.`,
    })

    // T-45: o convite 2 pela confirmação na linha
    fireEvent.press(screen.getByRole('button', { name: 'Revogar convite 2' }))
    expect(calls.chronicle.invitesDelete).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Revogar convite' }))
    })
    await waitFor(() =>
      expect(calls.chronicle.invitesDelete).toHaveBeenCalledWith('i1')
    )

    // Fechar esconde o código: reabrir não mostra o mesmo
    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Convidar' }))
    expect(screen.queryByText('ABCD EFGH JKMN PQRS TVWX YZ01 23')).toBeNull()
    expect(screen.queryByTestId('invite-link-value')).toBeNull()
  })

  it('T-45: revogar pede confirmação, com o foco em Cancelar e de volta', async () => {
    const focus = jest.spyOn(focusModule, 'focusView')
    calls.chronicle.get.mockResolvedValue(detail('storyteller', []))
    calls.chronicle.invitesGet.mockResolvedValue(inviteList())
    calls.chronicle.invitesDelete.mockResolvedValue(ok(null))
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(await screen.findByRole('button', { name: 'Convidar' }))
    // Dois do mesmo dia, distinguíveis pelo número e pela hora
    const t = (iso: string) => {
      const d = new Date(iso)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    expect(
      await screen.findByText(
        `Convite 3 · criado em 18/10 às ${t('2026-10-18T13:07:00Z')}`
      )
    ).toBeTruthy()
    expect(
      screen.getByText(
        `Convite 2 · criado em 18/10 às ${t('2026-10-18T12:00:00Z')}`
      )
    ).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Revogar convite 2' }))
    expect(
      screen.getByText(
        'Revogar o convite 2? Quem ainda não entrou não vai conseguir usar o link nem o código.'
      )
    ).toBeTruthy()
    // O alvo do foco, sem imprimir a árvore se falhar
    const focused = () => {
      const view = focus.mock.lastCall?.[0] as
        | { props?: { accessibilityLabel?: string; children?: unknown } }
        | null
        | undefined
      return String(view?.props?.accessibilityLabel ?? view?.props?.children)
    }
    expect(focused()).toBe('Cancelar')
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(calls.chronicle.invitesDelete).not.toHaveBeenCalled()
    // O foco volta ao gatilho da mesma linha
    expect(focused()).toBe('Revogar convite 2')

    // Uma confirmação por vez
    fireEvent.press(screen.getByRole('button', { name: 'Revogar convite 2' }))
    fireEvent.press(screen.getByRole('button', { name: 'Revogar convite 3' }))
    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Revogar convite 2' })
    ).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Revogar convite' }))
    })
    expect(calls.chronicle.invitesDelete).toHaveBeenCalledTimes(1)
    expect(calls.chronicle.invitesDelete).toHaveBeenCalledWith('i2')
    // Revogado: o foco vai para "Convites ativos"
    await waitFor(() => expect(focused()).toBe('Convites ativos'))
    focus.mockRestore()
  })

  it('a cópia que falha diz como copiar à mão, sem erro solto', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller', []))
    calls.chronicle.invitesGet.mockResolvedValue(inviteList())
    calls.chronicle.invitesPost.mockResolvedValue(created())
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error('x'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(await screen.findByRole('button', { name: 'Convidar' }))
    await act(async () => {
      fireEvent.press(
        await screen.findByRole('button', { name: 'Gerar convite' })
      )
    })
    await act(async () => {
      fireEvent.press(
        await screen.findByRole('button', { name: 'Copiar link' })
      )
    })
    expect(screen.getByTestId('invite-copy-status')).toHaveTextContent(
      'Não foi possível copiar. Selecione o link acima e copie.'
    )
    expect(screen.queryByRole('button', { name: 'Copiado' })).toBeNull()
  })

  it('T-44: no web sem Web Share, o botão é "Copiar mensagem"', async () => {
    const os = Platform.OS
    const page = globalThis as { navigator?: unknown }
    const navigator = page.navigator
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    page.navigator = {}
    try {
      calls.chronicle.get.mockResolvedValue(detail('storyteller', []))
      calls.chronicle.invitesGet.mockResolvedValue(inviteList())
      calls.chronicle.invitesPost.mockResolvedValue(created())
      const share = jest.spyOn(Share, 'share')
      renderWithSession(<ChronicleScreen />, await signedIn())
      fireEvent.press(await screen.findByRole('button', { name: 'Convidar' }))
      await act(async () => {
        fireEvent.press(
          await screen.findByRole('button', { name: 'Gerar convite' })
        )
      })
      expect(screen.queryByRole('button', { name: 'Compartilhar' })).toBeNull()
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Copiar mensagem' }))
      })
      expect(share).not.toHaveBeenCalled()
      expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
        expect.stringContaining(`/join#${CODE}`)
      )
      expect(screen.getByTestId('invite-copy-status')).toHaveTextContent(
        'Mensagem copiada.'
      )
    } finally {
      page.navigator = navigator
      Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
    }
  })

  it('erro ao gerar o convite aparece no sheet', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    calls.chronicle.invitesGet.mockResolvedValue(ok([]))
    calls.chronicle.invitesPost.mockResolvedValue(
      fail(403, 'só o narrador pode fazer isso')
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(await screen.findByRole('button', { name: 'Convidar' }))
    expect(await screen.findByText('Nenhum convite ativo.')).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Gerar convite' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'só o narrador pode fazer isso'
    )
  })
})
