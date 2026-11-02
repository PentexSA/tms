import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { effectiveCreationConfig } from '@tms/sheet-core'
import { useRouter } from 'expo-router'
import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import { example, modelOf, templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import { openingMode, SheetScreen } from '../SheetScreen'

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const ID = '00000000-0000-4000-8000-00000000c001'

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

const character = (sheet = example('helena').sheet) =>
  ok({
    id: ID,
    name: 'Helena Varga',
    chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
    owner: { id: 'u1', username: 'dona' },
    systemCode: 'vtm-v20',
    templateVersion: '1.0.0',
    sheetVersion: 3,
    roles: ['owner'],
    // Ficha em uso: a dona abre em Jogo (a em criação abre na montagem, T-05)
    status: 'active',
    lockedAt: null,
    member: true,
    updatedAt: '2026-10-18T12:00:00Z',
    sheet,
  })

// NPC revelado (v5): a projeção pública e a de leitura do viewer
// Folga para o hook de push, que roda as suítes em paralelo
const WAIT = { timeout: 5000 }
const NPC = '00000000-0000-4000-8000-00000000c009'
const identity = {
  name: 'Oráculo',
  chip: 'Tremere',
  subtitle: null,
  portraitUrl: null,
}
const npcIdentity = () =>
  ok({
    projection: 'identity',
    id: NPC,
    kind: 'npc',
    visibility: 'identity',
    identity,
  })
const npcFull = () =>
  ok({
    projection: 'full',
    id: NPC,
    kind: 'npc',
    visibility: 'full',
    identity,
    chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
    systemCode: 'vtm-v20',
    templateVersion: '1.0.0',
    roles: ['viewer'],
    status: 'active',
    lockedAt: null,
    sheet: example('helena').sheet,
  })

describe('SheetScreen: redução da visibilidade de um NPC', () => {
  it('ficha → identidade → oculto: cada revalidação troca a projeção e o 404 limpa o cache', async () => {
    calls.characterGet.mockResolvedValueOnce(npcFull())
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { queryClient } = renderWithSession(
      <SheetScreen id={NPC} />,
      await signedIn()
    )
    expect(
      await screen.findByText('Leitura', { exact: true }, WAIT)
    ).toBeTruthy()
    expect(screen.getByLabelText('Destreza, 2 de 5')).toBeTruthy()

    calls.characterGet.mockResolvedValueOnce(npcIdentity())
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ['characters', NPC] })
    )
    expect(
      await screen.findByText(
        'O narrador revelou apenas a identidade.',
        {},
        WAIT
      )
    ).toBeTruthy()
    // A projeção menor substitui a anterior: nada da ficha fica na tela
    expect(screen.queryByLabelText('Destreza, 2 de 5')).toBeNull()

    calls.characterGet.mockResolvedValueOnce(fail(404, 'não encontrado'))
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ['characters', NPC] })
    )
    expect(
      await screen.findByRole(
        'header',
        { name: 'Você não tem acesso a esta ficha' },
        WAIT
      )
    ).toBeTruthy()
    await waitFor(
      () =>
        expect(queryClient.getQueryData(['characters', NPC])).toBeUndefined(),
      WAIT
    )
    expect(screen.queryByText('Oráculo')).toBeNull()
  })

  it('sem rede, a ficha do viewer em cache não volta à tela', async () => {
    calls.characterGet.mockResolvedValueOnce(npcFull())
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { queryClient } = renderWithSession(
      <SheetScreen id={NPC} />,
      await signedIn()
    )
    expect(
      await screen.findByLabelText('Destreza, 2 de 5', {}, WAIT)
    ).toBeTruthy()
    calls.characterGet.mockRejectedValueOnce(
      new TypeError('Network request failed')
    )
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ['characters', NPC] })
    )
    // O erro aparece no lugar da ficha: a cópia do viewer não fica na tela
    expect(
      await screen.findByRole(
        'header',
        { name: 'Não foi possível carregar a ficha' },
        WAIT
      )
    ).toBeTruthy()
    expect(screen.queryByLabelText('Destreza, 2 de 5')).toBeNull()
  })
})

describe('SheetScreen', () => {
  it('carrega a ficha e o template da versão dela', async () => {
    calls.characterGet.mockResolvedValue(character())
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(screen.getByLabelText('Carregando a ficha')).toBeTruthy()
    expect(await screen.findByLabelText('Destreza, 2 de 5')).toBeTruthy()
    expect(calls.characterGet).toHaveBeenCalledWith(ID, expect.anything())
    expect(calls.templateGet).toHaveBeenCalledWith(
      'vtm-v20',
      expect.objectContaining({ query: { version: '1.0.0' } })
    )
    fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para Crônica da Liberdade' })
    )
    expect(router.replace).toHaveBeenCalledWith('/chronicles/c1')
  })

  it('sem acesso (404)', async () => {
    calls.characterGet.mockResolvedValue(fail(404, 'não encontrado'))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(
      await screen.findByRole('header', {
        name: 'Você não tem acesso a esta ficha',
      })
    ).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para Crônicas' })
    )
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('template que o app não conhece: "Atualize o app" com saída (L-02)', async () => {
    const t = templateJson('vtm-v20')
    t.schema = 2
    calls.characterGet.mockResolvedValue(character())
    calls.templateGet.mockResolvedValue(ok(t))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Atualize o app' })
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('ficha que não passa no validador não abre', async () => {
    const sheet = example('helena').sheet
    ;(sheet.values as Record<string, unknown>).strength = 99
    calls.characterGet.mockResolvedValue(character(sheet))
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(
      await screen.findByRole('header', {
        name: 'Não foi possível abrir a ficha',
      })
    ).toBeTruthy()
    expect(screen.queryByLabelText(/Força/)).toBeNull()
  })

  it('refetch que falha (sem rede) não tira a ficha da tela', async () => {
    calls.characterGet.mockResolvedValueOnce(character())
    calls.characterGet.mockResolvedValue({
      data: null,
      error: { status: 503, value: new TypeError('Failed to fetch') },
    })
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { queryClient } = renderWithSession(
      <SheetScreen id={ID} />,
      await signedIn()
    )
    expect(await screen.findByLabelText('Destreza, 2 de 5')).toBeTruthy()
    await act(() => queryClient.invalidateQueries())
    await waitFor(() =>
      expect(queryClient.getQueryState(['characters', ID])?.status).toBe(
        'error'
      )
    )
    // Deixa a tela reagir ao erro antes de conferir
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })
    expect(screen.queryByText('Não foi possível carregar a ficha')).toBeNull()
    expect(screen.getByLabelText('Destreza, 2 de 5')).toBeTruthy()
  })

  it.each(['ficha', 'template'])(
    'erro ao carregar o %s: tentar de novo',
    async what => {
      if (what === 'ficha') {
        calls.characterGet.mockResolvedValueOnce(fail(500, 'erro interno'))
        calls.characterGet.mockResolvedValue(character())
        calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
      } else {
        calls.characterGet.mockResolvedValue(character())
        calls.templateGet.mockResolvedValueOnce(fail(500, 'erro interno'))
        calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
      }
      renderWithSession(<SheetScreen id={ID} />, await signedIn())
      fireEvent.press(
        await screen.findByRole('button', { name: 'Tentar de novo' })
      )
      await waitFor(() =>
        expect(screen.getByLabelText('Destreza, 2 de 5')).toBeTruthy()
      )
    }
  )
})

// T-05: a ficha em criação da dona abre na montagem por qualquer entrada
// (lista, link, recarga), não só logo depois de "Criar ficha"
describe('modo de abertura (T-05)', () => {
  const vtm = modelOf('vtm-v20')
  const creation = (mode: 'points' | 'free', extra = {}) => ({
    revision: 1,
    mode,
    accounting: true,
    choices: {},
    config: mode === 'free' ? { mode: 'free' } : {},
    effective: { ...effectiveCreationConfig(vtm), mode },
    returned: null,
    approval: false,
    ...extra,
  })
  const creating = (over: Record<string, unknown> = {}) =>
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
      creation: creation('points'),
      ...over,
    })
  const radio = (name: string) => screen.findByRole('radio', { name }, WAIT)

  it.each([
    [['owner'], 'creating', true, true, 'create'],
    [['owner'], 'creating', false, true, 'evolve'],
    [['owner'], 'creating', true, false, 'play'],
    [['owner'], 'active', false, true, 'play'],
    [['owner'], 'pending', true, true, 'play'],
    [['storyteller'], 'creating', true, true, 'read'],
    // O NPC do narrador em criação não muda
    [['owner', 'storyteller'], 'creating', false, true, 'play'],
  ] as const)(
    'openingMode(%j, %s, conta %s, escreve %s) = %s',
    (roles, status, active, writer, expected) => {
      expect(openingMode({ roles, status, active, writer })).toBe(expected)
    }
  )

  it('por pontos, sem ?mode=, abre em Criação', async () => {
    calls.characterGet.mockResolvedValue(creating())
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(await radio('Criação')).toBeChecked()
    expect(screen.getByRole('tab', { name: 'Orçamento' })).toBeTruthy()
  })

  it('na criação livre, sem ?mode=, abre em Editar', async () => {
    calls.characterGet.mockResolvedValue(
      creating({ creation: creation('free') })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(await radio('Editar')).toBeChecked()
    expect(screen.getByText('Editando · 0 alterações')).toBeTruthy()
  })

  it('pending abre em Leitura, com "Aguardando aprovação"; ex-membro, em Leitura', async () => {
    calls.characterGet.mockResolvedValue(creating({ status: 'pending' }))
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { unmount } = renderWithSession(
      <SheetScreen id={ID} />,
      await signedIn()
    )
    expect(
      await screen.findByText('Aguardando aprovação', {}, WAIT)
    ).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Criação' })).toBeNull()
    unmount()
    calls.characterGet.mockResolvedValue(creating({ member: false }))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(await screen.findByTestId('policy-banner', {}, WAIT)).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Criação' })).toBeNull()
    expect(screen.queryByText(/^Editando/)).toBeNull()
  })

  it('devolvida (pending → creating), vai à Criação', async () => {
    calls.characterGet.mockResolvedValue(creating({ status: 'pending' }))
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { queryClient } = renderWithSession(
      <SheetScreen id={ID} />,
      await signedIn()
    )
    await screen.findByText('Aguardando aprovação', {}, WAIT)
    calls.characterGet.mockResolvedValue(
      creating({
        creation: creation('points', {
          returned: { reason: 'Falta o Clã', at: '2026-11-02T12:00:00Z' },
        }),
      })
    )
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ['characters', ID] })
    )
    expect(await radio('Criação')).toBeChecked()
  })

  it('liberar a criação livre com 2 alterações em Criação leva a Editar com as 2', async () => {
    calls.characterGet.mockResolvedValue(
      creating({
        creation: {
          ...creation('points'),
          choices: {
            priorities: { attributes: ['physical', 'social', 'mental'] },
          },
        },
      })
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { queryClient } = renderWithSession(
      <SheetScreen id={ID} />,
      await signedIn()
    )
    expect(await radio('Criação')).toBeChecked()
    for (const name of ['Força', 'Destreza'])
      fireEvent(
        screen.getByRole('adjustable', { name }),
        'accessibilityAction',
        { nativeEvent: { actionName: 'increment' } }
      )
    calls.characterGet.mockResolvedValue(
      creating({ creation: creation('free') })
    )
    await act(() =>
      queryClient.invalidateQueries({ queryKey: ['characters', ID] })
    )
    expect(await radio('Editar')).toBeChecked()
    expect(screen.getByText('Editando · 2 alterações')).toBeTruthy()
  })
})
