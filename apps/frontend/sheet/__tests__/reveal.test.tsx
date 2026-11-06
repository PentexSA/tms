import { focusManager, onlineManager } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { RoleName } from '@tms/sheet-core'
import { useRouter } from 'expo-router'
import { AccessibilityInfo } from 'react-native'

import * as apiModule from '../../lib/api'
import {
  parseRevealed,
  REVEALED_REFETCH_MS,
  revealKeys,
} from '../../lib/queries/reveal'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import { modelOf, sheetFor, templateJson } from '../../test/fixtures'
import { sheetsDismissed } from '../../test/queries'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import { EVENT_LABELS } from '../history/HistorySheet'
import { SheetScreen } from '../SheetScreen'
import { revealOf } from '../storyteller/revealed'

// U-11 (P16-D): o narrador revela as Notas do Narrador ao dono (com
// confirmação) e as deixa privadas de novo; o dono lê só em leitura, pela
// rota própria, e o texto sai da tela quando a nota volta a ser privada.

// Chaves de comando de verdade, para comparar uma tentativa com a outra
jest.mock('expo-crypto', () => ({
  randomUUID: () => require('node:crypto').randomUUID(),
}))
jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const ID = '00000000-0000-4000-8000-00000000c016'
const SENTINEL = 'SENTINELA-P16 nota de teste'

beforeEach(() => {
  onlineManager.setOnline(true)
  jest.mocked(useRouter).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  } as never)
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation()
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  calls.revealPost.mockReset()
  calls.revealedGet.mockReset()
  calls.characterGet.mockClear()
})

afterEach(() => onlineManager.setOnline(true))

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

const character = (
  roles: RoleName[],
  reveal: { sections: string[]; revision: number } = {
    sections: [],
    revision: 0,
  },
  extra: Record<string, unknown> = {}
) =>
  ok({
    projection: 'full',
    id: ID,
    name: 'Helena Varga',
    kind: 'pc',
    visibility: 'hidden',
    visibilityRevision: 0,
    presentationRevision: 0,
    identity: { name: 'Helena Varga' },
    chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
    owner: { id: 'u1', username: 'dona' },
    systemCode: 'vtm-v20',
    templateVersion: '1.0.0',
    sheetVersion: 3,
    roles,
    member: true,
    reveal,
    updatedAt: '2026-10-18T12:00:00Z',
    sheet: (() => {
      const { sheet } = sheetFor('helena', roles)
      return roles.includes('storyteller')
        ? { ...sheet, values: { ...sheet.values, storytellerNotes: SENTINEL } }
        : sheet
    })(),
    ...extra,
  })

const revealedBody = (revision: number, text = SENTINEL) =>
  ok({
    revision,
    sections: [{ id: 'storyteller', values: { storytellerNotes: text } }],
  })

async function open(roles: RoleName[], first = character(roles)) {
  calls.characterGet.mockResolvedValue(first)
  const view = renderWithSession(<SheetScreen id={ID} />, await signedIn())
  await screen.findByLabelText(/^Destreza, 2 de 5/)
  fireEvent.press(screen.getByRole('tab', { name: 'Sobre' }))
  return view
}

describe('o narrador revela e esconde', () => {
  it('revelar pede confirmação com o texto; cancelar não envia', async () => {
    await open(['storyteller'])
    const button = screen.getByRole('button', {
      name: 'Revelar ao jogador: Notas do Narrador a dona',
    })
    fireEvent.press(button)
    await screen.findByText('Revelar as Notas do Narrador a dona?')
    // O texto que vai ser revelado, para conferir
    expect(screen.getByTestId('reveal-notes-text')).toHaveTextContent(SENTINEL)
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    await sheetsDismissed()
    expect(calls.revealPost).not.toHaveBeenCalled()
  })

  it('"Revelar notas" envia a seção e a revisão; o rótulo e o editor passam a "reveladas"', async () => {
    await open(['storyteller'])
    calls.revealPost.mockResolvedValue(
      ok({
        section: 'storyteller',
        revealed: true,
        sections: ['storyteller'],
        revision: 1,
        duplicate: false,
      })
    )
    calls.characterGet.mockResolvedValue(
      character(['storyteller'], { sections: ['storyteller'], revision: 1 })
    )
    fireEvent.press(screen.getByRole('button', { name: /^Revelar ao jogador/ }))
    await screen.findByText('Revelar as Notas do Narrador a dona?')
    fireEvent.press(screen.getByRole('button', { name: 'Revelar notas' }))
    await waitFor(() => expect(calls.revealPost).toHaveBeenCalledTimes(1))
    const [, body] = calls.revealPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(body).toMatchObject({
      section: 'storyteller',
      revealed: true,
      revision: 0,
    })
    expect(body).toHaveProperty('clientCommandId')
    await sheetsDismissed()
    // O toast depois da folha
    expect(
      await screen.findByText('Notas reveladas a dona, só leitura.')
    ).toBeTruthy()
    expect(
      await screen.findByText('Notas do Narrador · reveladas: dona lê')
    ).toBeTruthy()
    expect(screen.getByLabelText(/Reveladas: dona lê$/)).toBeTruthy()
    // O editor diz que o dono lê o que for salvo
    fireEvent.press(
      screen.getByRole('button', { name: 'Editar como narrador' })
    )
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Editar Notas do Narrador. Reveladas: dona lê',
      })
    )
    expect(
      screen.getByText('Reveladas: dona lê o que você salvar aqui.')
    ).toBeTruthy()
  })

  it('"Deixar privadas" envia direto e avisa que quem já leu continua sabendo', async () => {
    await open(
      ['storyteller'],
      character(['storyteller'], { sections: ['storyteller'], revision: 4 })
    )
    calls.revealPost.mockResolvedValue(
      ok({
        section: 'storyteller',
        revealed: false,
        sections: [],
        revision: 5,
        duplicate: false,
      })
    )
    fireEvent.press(screen.getByRole('button', { name: /^Deixar privadas/ }))
    await waitFor(() => expect(calls.revealPost).toHaveBeenCalledTimes(1))
    expect(calls.revealPost.mock.calls[0]?.[1]).toMatchObject({
      revealed: false,
      revision: 4,
    })
    expect(
      await screen.findByText(
        'As notas voltaram a ser privadas. Quem já leu continua sabendo.'
      )
    ).toBeTruthy()
  })

  it('a chave de comando fica no reenvio e gira quando a revisão observada muda', async () => {
    const { queryClient } = await open(['storyteller'])
    // Resultado desconhecido (5xx): a nova tentativa é a mesma intenção
    calls.revealPost.mockResolvedValue(fail(503, 'indisponível'))
    fireEvent.press(screen.getByRole('button', { name: /^Revelar ao jogador/ }))
    await screen.findByText('Revelar as Notas do Narrador a dona?')
    fireEvent.press(screen.getByRole('button', { name: 'Revelar notas' }))
    await waitFor(() => expect(calls.revealPost).toHaveBeenCalledTimes(1))
    await screen.findByText('indisponível')
    fireEvent.press(screen.getByRole('button', { name: 'Revelar notas' }))
    await waitFor(() => expect(calls.revealPost).toHaveBeenCalledTimes(2))
    const body = (n: number) =>
      calls.revealPost.mock.calls[n]?.[1] as {
        clientCommandId: string
        revision: number
      }
    expect(body(1).clientCommandId).toBe(body(0).clientCommandId)
    // Outro aparelho revelou e escondeu: a ficha volta com a revisão 2
    calls.characterGet.mockResolvedValue(
      character(['storyteller'], { sections: [], revision: 2 })
    )
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: ['characters', ID],
        exact: true,
      })
    )
    await waitFor(() =>
      expect(
        (
          queryClient.getQueryData(['characters', ID]) as {
            reveal: { revision: number }
          }
        ).reveal.revision
      ).toBe(2)
    )
    await act(() => new Promise(resolve => setTimeout(resolve, 0)))
    fireEvent.press(screen.getByRole('button', { name: 'Revelar notas' }))
    await waitFor(() => expect(calls.revealPost).toHaveBeenCalledTimes(3))
    expect(body(2).revision).toBe(2)
    expect(body(2).clientCommandId).not.toBe(body(0).clientCommandId)
  })

  it('no sucesso, a ficha em cache já traz o estado novo, sem esperar a rebusca', async () => {
    const { queryClient } = await open(['storyteller'])
    calls.revealPost.mockResolvedValue(
      ok({
        section: 'storyteller',
        revealed: true,
        sections: ['storyteller'],
        revision: 1,
        duplicate: false,
      })
    )
    // A rebusca da ficha não volta: o que muda vem da resposta do comando
    calls.characterGet.mockReturnValue(new Promise(() => undefined))
    fireEvent.press(screen.getByRole('button', { name: /^Revelar ao jogador/ }))
    await screen.findByText('Revelar as Notas do Narrador a dona?')
    fireEvent.press(screen.getByRole('button', { name: 'Revelar notas' }))
    expect(
      await screen.findByText('Notas do Narrador · reveladas: dona lê')
    ).toBeTruthy()
    expect(
      (
        queryClient.getQueryData(['characters', ID]) as {
          reveal: { sections: string[]; revision: number }
        }
      ).reveal
    ).toEqual({ sections: ['storyteller'], revision: 1 })
  })

  it('o 409 da revisão velha aparece dentro da folha', async () => {
    await open(['storyteller'])
    calls.revealPost.mockResolvedValue(
      fail(409, 'Os dados mudaram. Atualize para continuar.')
    )
    fireEvent.press(screen.getByRole('button', { name: /^Revelar ao jogador/ }))
    await screen.findByText('Revelar as Notas do Narrador a dona?')
    fireEvent.press(screen.getByRole('button', { name: 'Revelar notas' }))
    expect(
      await screen.findByText('Os dados mudaram. Atualize para continuar.')
    ).toBeTruthy()
    expect(screen.getByTestId('reveal-notes-sheet')).toBeTruthy()
  })

  it('sem rede, o toque diz por que não envia', async () => {
    await open(['storyteller'])
    act(() => onlineManager.setOnline(false))
    fireEvent.press(screen.getByRole('button', { name: /^Revelar ao jogador/ }))
    expect(
      screen.getByText('Sem conexão: revelar e esconder precisam de rede.')
    ).toBeTruthy()
    expect(calls.revealPost).not.toHaveBeenCalled()
  })

  it('NPC e a ficha do próprio narrador não têm o botão', async () => {
    await open(
      ['storyteller'],
      character(['storyteller'], undefined, {
        kind: 'npc',
        visibility: 'hidden',
      })
    )
    expect(
      screen.queryByRole('button', { name: /^Revelar ao jogador/ })
    ).toBeNull()
  })

  it('na própria ficha, o narrador não tem o botão', async () => {
    await open(['owner', 'storyteller'])
    expect(
      screen.queryByRole('button', { name: /^Revelar ao jogador/ })
    ).toBeNull()
  })
})

describe('o dono lê as notas reveladas', () => {
  it('a aba "Sobre" mostra o texto revelado, só leitura', async () => {
    calls.revealedGet.mockResolvedValue(revealedBody(2))
    await open(
      ['owner'],
      character(['owner'], { sections: ['storyteller'], revision: 2 })
    )
    expect(
      await screen.findByText('Notas do Narrador · reveladas pelo narrador')
    ).toBeTruthy()
    expect(await screen.findByText(SENTINEL)).toBeTruthy()
    expect(
      screen.getByLabelText(
        `Notas do Narrador, reveladas pelo narrador: ${SENTINEL}`
      )
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /Editar Notas do Narrador/ })
    ).toBeNull()
  })

  it('sem revelação, nada da seção e nenhuma consulta', async () => {
    await open(['owner'])
    expect(screen.queryByText(/reveladas pelo narrador/)).toBeNull()
    expect(calls.revealedGet).not.toHaveBeenCalled()
  })

  it('a ficha volta com a nota privada: o bloco some e a consulta sai da memória', async () => {
    calls.revealedGet.mockResolvedValue(revealedBody(2))
    const { queryClient } = await open(
      ['owner'],
      character(['owner'], { sections: ['storyteller'], revision: 2 })
    )
    expect(await screen.findByText(SENTINEL)).toBeTruthy()
    calls.characterGet.mockResolvedValue(
      character(['owner'], { sections: [], revision: 3 })
    )
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: ['characters', ID],
        exact: true,
      })
    )
    await waitFor(() => expect(screen.queryByText(SENTINEL)).toBeNull())
    expect(queryClient.getQueryData(revealKeys.revealed(ID))).toBeUndefined()
  })

  // §11.6, ponto 3: "Deixar privadas" com a tela do dono aberta. Sem push,
  // a rebusca de 30 s da rota tira o bloco sem recarregar
  it('com a tela aberta, a nota escondida some na rebusca de 30 s', async () => {
    jest.useFakeTimers()
    try {
      calls.revealedGet.mockResolvedValue(revealedBody(2))
      await open(
        ['owner'],
        character(['owner'], { sections: ['storyteller'], revision: 2 })
      )
      expect(await screen.findByText(SENTINEL)).toBeTruthy()
      // O narrador deixa privadas: a rota e a ficha dizem a revisão nova
      calls.revealedGet.mockResolvedValue(ok({ revision: 3, sections: [] }))
      calls.characterGet.mockResolvedValue(
        character(['owner'], { sections: [], revision: 3 })
      )
      const before = calls.revealedGet.mock.calls.length
      // Antes do intervalo, nada muda na tela
      await act(async () => {
        jest.advanceTimersByTime(REVEALED_REFETCH_MS - 1_000)
      })
      expect(screen.getByText(SENTINEL)).toBeTruthy()
      expect(calls.revealedGet.mock.calls.length).toBe(before)
      await act(async () => {
        jest.advanceTimersByTime(1_000)
      })
      await waitFor(() => expect(screen.queryByText(SENTINEL)).toBeNull())
      expect(calls.revealedGet.mock.calls.length).toBe(before + 1)
      expect(screen.queryByText(/reveladas pelo narrador/)).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  // A consulta fica acima das abas: trocar de aba não a rebuscava, e a nota
  // escondida continuava no "Sobre" até a rebusca de 30 s
  it('ao voltar para a aba "Sobre", a nota escondida some na hora', async () => {
    calls.revealedGet.mockResolvedValue(revealedBody(2))
    await open(
      ['owner'],
      character(['owner'], { sections: ['storyteller'], revision: 2 })
    )
    expect(await screen.findByText(SENTINEL)).toBeTruthy()
    fireEvent.press(screen.getByRole('tab', { name: 'Ficha' }))
    expect(screen.queryByText(SENTINEL)).toBeNull()
    const before = calls.revealedGet.mock.calls.length
    calls.revealedGet.mockResolvedValue(ok({ revision: 3, sections: [] }))
    calls.characterGet.mockResolvedValue(
      character(['owner'], { sections: [], revision: 3 })
    )
    fireEvent.press(screen.getByRole('tab', { name: 'Sobre' }))
    await waitFor(() =>
      expect(screen.queryByText(/reveladas pelo narrador/)).toBeNull()
    )
    expect(screen.queryByText(SENTINEL)).toBeNull()
    // Um pedido só ao aparecer, sem esperar o intervalo
    expect(calls.revealedGet.mock.calls.length).toBe(before + 1)
  })

  it('ao voltar ao primeiro plano, a nota escondida some na hora', async () => {
    calls.revealedGet.mockResolvedValue(revealedBody(2))
    await open(
      ['owner'],
      character(['owner'], { sections: ['storyteller'], revision: 2 })
    )
    expect(await screen.findByText(SENTINEL)).toBeTruthy()
    act(() => focusManager.setFocused(false))
    calls.revealedGet.mockResolvedValue(ok({ revision: 3, sections: [] }))
    calls.characterGet.mockResolvedValue(
      character(['owner'], { sections: [], revision: 3 })
    )
    try {
      // O AppState "active" do _layout.tsx (no web, o visibilitychange)
      act(() => focusManager.setFocused(true))
      await waitFor(() => expect(screen.queryByText(SENTINEL)).toBeNull())
    } finally {
      focusManager.setFocused(undefined)
    }
  })

  it('resposta mais velha que a ficha é descartada', async () => {
    calls.revealedGet.mockResolvedValueOnce(revealedBody(1, 'TEXTO-VELHO'))
    calls.revealedGet.mockResolvedValue(revealedBody(3, 'TEXTO-NOVO'))
    await open(
      ['owner'],
      character(['owner'], { sections: ['storyteller'], revision: 3 })
    )
    expect(await screen.findByText('TEXTO-NOVO')).toBeTruthy()
    expect(screen.queryByText('TEXTO-VELHO')).toBeNull()
  })

  it('sem rede e sem o texto na memória: "Conecte-se"', async () => {
    // A ficha abre (do cache ou antes de a rede cair); a nota ainda não veio
    calls.revealedGet.mockReturnValue(new Promise(() => undefined))
    await open(
      ['owner'],
      character(['owner'], { sections: ['storyteller'], revision: 2 })
    )
    act(() => onlineManager.setOnline(false))
    expect(
      await screen.findByText('Conecte-se para ler as notas reveladas.')
    ).toBeTruthy()
    expect(screen.queryByText(SENTINEL)).toBeNull()
  })

  it('o 404 da rota tira o bloco, pede a rota uma vez só e rebusca a ficha', async () => {
    calls.revealedGet.mockResolvedValue(fail(404, 'não encontrado'))
    await open(
      ['owner'],
      character(['owner'], { sections: ['storyteller'], revision: 2 })
    )
    await waitFor(() =>
      expect(screen.queryByText(/reveladas pelo narrador/)).toBeNull()
    )
    // A ficha é rebuscada depois do 404 (a abertura foi o primeiro pedido)
    await waitFor(() =>
      expect(calls.characterGet.mock.calls.length).toBeGreaterThanOrEqual(2)
    )
    // Sem laço: a consulta desligada não volta a pedir
    await act(() => new Promise(resolve => setTimeout(resolve, 200)))
    expect(calls.revealedGet).toHaveBeenCalledTimes(1)
  })
})

describe('o que vem da rede é input hostil', () => {
  const model = modelOf('vtm-v20')

  it('revealOf: só seções reveláveis, até 8, sem repetir; revisão inteira', () => {
    expect(revealOf(model, null)).toEqual({ sections: [], revision: 0 })
    expect(
      revealOf(model, {
        sections: ['storyteller', 'storyteller', 'about', 3, 'x'],
        revision: 2,
      })
    ).toEqual({ sections: ['storyteller'], revision: 2 })
    expect(revealOf(model, { sections: 'storyteller', revision: -1 })).toEqual({
      sections: [],
      revision: 0,
    })
  })

  it('parseRevealed: forma errada vira nada; valores só texto', () => {
    expect(parseRevealed(null)).toEqual({ revision: -1, sections: [] })
    expect(
      parseRevealed({
        revision: 1,
        sections: [
          { id: 'storyteller', values: { storytellerNotes: 'a', n: 3 } },
          { id: 2 },
          'x',
        ],
      })
    ).toEqual({
      revision: 1,
      sections: [{ id: 'storyteller', values: { storytellerNotes: 'a' } }],
    })
  })

  it('o Histórico tem rótulo para os passos novos', () => {
    expect(EVENT_LABELS['section.revealed']).toBe(
      'Notas privadas reveladas ao jogador'
    )
    expect(EVENT_LABELS['section.hidden']).toBe('Notas voltaram a ser privadas')
  })
})
