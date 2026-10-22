import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { SheetData } from '@tms/sheet-core'
import { useRouter } from 'expo-router'
import { AccessibilityInfo, Dimensions } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, ok } from '../../test/fake-api'
import { example, modelOf, templateJson } from '../../test/fixtures'
import { renderLive } from '../../test/live'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import type { SheetLifecycle } from '../policy'
import { SheetScreen } from '../SheetScreen'
import { statusActions } from '../storyteller/StatusMenu'

// v3, Etapa 6: a ficha usa a política só para desabilitar o que o servidor
// vai recusar, com o motivo no lugar; o narrador muda o estado pelo menu ⋯.

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

const vtm = modelOf('vtm-v20')
const helena = example('helena').sheet as unknown as SheetData
const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }
const ID = '00000000-0000-4000-8000-00000000c001'

const lifecycle = (status: string, locked = false): SheetLifecycle => ({
  status,
  locked,
  member: true,
})

beforeEach(() => {
  Dimensions.set({ window: PHONE, screen: PHONE })
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined)
  jest
    .mocked(useRouter)
    .mockReturnValue({ push: jest.fn(), replace: jest.fn() } as never)
})
afterEach(() => {
  Dimensions.set({ window: TABLET, screen: TABLET })
})

const serverPost = jest.fn()

describe('Evoluir depois da criação', () => {
  it('em active, o stepper de Força está desabilitado com o motivo, e Conceito não', async () => {
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'evolve',
        lifecycle: lifecycle('active'),
      },
      serverPost
    )
    const strength = screen.getByRole('adjustable', { name: 'Força' })
    expect(strength.props['aria-disabled']).toBe(true)
    expect(screen.getAllByText('Peça ao narrador.').length).toBeGreaterThan(0)
    // Texto continua editável: abre o editor
    fireEvent.press(screen.getByTestId('editor-concept'))
    expect(await screen.findByRole('header', { name: 'Conceito' })).toBeTruthy()
  })

  it('em active, a FdV permanente não muda, e a temporária muda', async () => {
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'evolve',
        lifecycle: lifecycle('active'),
      },
      serverPost
    )
    const permanent = screen.getByRole('adjustable', {
      name: 'Força de Vontade permanente',
    })
    const current = screen.getByRole('adjustable', {
      name: 'Força de Vontade atual',
    })
    expect(permanent.props['aria-disabled']).toBe(true)
    expect(current.props['aria-disabled']).toBe(false)
  })

  it('em creating, nada muda: o stepper de Força está livre', async () => {
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'evolve',
        lifecycle: lifecycle('creating'),
      },
      serverPost
    )
    const strength = screen.getByRole('adjustable', { name: 'Força' })
    expect(strength.props['aria-disabled']).toBe(false)
    expect(screen.queryByText('Peça ao narrador.')).toBeNull()
  })
})

describe('ficha travada', () => {
  it('o dock não abre o sheet de gasto, e o motivo é anunciado', async () => {
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'play',
        lifecycle: lifecycle('active', true),
      },
      serverPost
    )
    expect(screen.getByTestId('policy-banner')).toBeTruthy()
    // Sem o Editar: a política tirou
    expect(screen.queryByRole('radio', { name: 'Editar' })).toBeNull()
    fireEvent.press(screen.getByTestId('dock-blood'))
    expect(screen.queryByTestId('play-sheet')).toBeNull()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'O narrador travou a ficha.'
    )
  })
})

describe('as ações do narrador por estado', () => {
  const ids = (status: string, locked = false, system = 'vtm-v20') =>
    statusActions(modelOf(system), status, locked).map(a => a.label)

  it('só as válidas no estado', () => {
    expect(ids('creating')).toEqual([
      'Concluir criação',
      'Arquivar',
      'Marcar como Torpor',
    ])
    expect(ids('active')).toEqual(['Travar', 'Arquivar', 'Marcar como Torpor'])
    expect(ids('active', true)).toEqual([
      'Destravar',
      'Arquivar',
      'Marcar como Torpor',
    ])
    expect(ids('archived')).toEqual(['Reativar', 'Marcar como Torpor'])
    expect(ids('dead')).toEqual(['Reativar', 'Arquivar'])
    expect(ids('pending')).toEqual([])
  })

  it('sem statusLabels no template (CoC), o rótulo é "Fora de jogo"', () => {
    expect(ids('active', false, 'coc7e')).toEqual([
      'Travar',
      'Arquivar',
      'Marcar como Fora de jogo',
    ])
  })

  it('o fixture de D&D mostra o mesmo menu, com o rótulo de dead dele', () => {
    expect(ids('active', false, 'dnd5e-2014')).toEqual([
      'Travar',
      'Arquivar',
      'Marcar como Morto',
    ])
  })

  it('arquivar e dead pedem confirmação; o resto aplica no toque', () => {
    const asks = statusActions(vtm, 'active', false).filter(a => a.confirm)
    expect(asks.map(a => a.id)).toEqual(['archive', 'dead'])
  })
})

describe('a tela da ficha com o estado', () => {
  async function signedIn() {
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    return session
  }

  const character = (
    roles: string[],
    status: string,
    lockedAt: string | null = null
  ) =>
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
      lockedAt,
      member: true,
      updatedAt: '2026-10-18T12:00:00Z',
      sheet: helena,
    })

  async function open(roles: string[], status: string, lockedAt?: string) {
    calls.characterGet.mockResolvedValue(character(roles, status, lockedAt))
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(await screen.findByLabelText('Destreza, 2 de 5')).toBeTruthy()
  }

  it('o dono não tem o menu do narrador', async () => {
    await open(['owner'], 'creating')
    expect(screen.queryByLabelText('Ações do narrador')).toBeNull()
    expect(screen.queryByTestId('policy-banner')).toBeNull()
  })

  it('arquivada, o dono abre em Leitura, com o aviso e sem o seletor de modo', async () => {
    await open(['owner'], 'archived')
    expect(screen.getByTestId('policy-banner')).toBeTruthy()
    expect(screen.getByText('Ficha arquivada')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Editar' })).toBeNull()
    expect(screen.queryByTestId('dock-blood')).toBeNull()
  })

  it('travada, o dono fica em Jogo: rola, mas não edita', async () => {
    await open(['owner'], 'active', '2026-10-18T12:00:00Z')
    expect(screen.getByText('O narrador travou a ficha')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dados' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Editar' })).toBeNull()
  })

  it('o narrador conclui a criação pelo menu ⋯', async () => {
    calls.completePost.mockResolvedValue(
      ok({ status: 'active', lockedAt: null, creationCompletedAt: 'x' })
    )
    await open(['storyteller'], 'creating')
    fireEvent.press(screen.getByLabelText('Ações do narrador'))
    await act(async () => {
      fireEvent.press(screen.getByTestId('status-complete'))
    })
    expect(calls.completePost).toHaveBeenCalledWith(ID)
    expect(
      await screen.findByText(
        'Criação concluída. Subir um traço agora passa por você.'
      )
    ).toBeTruthy()
  })

  it('arquivar pede confirmação antes de chamar o servidor', async () => {
    calls.statusPost.mockResolvedValue(
      ok({ status: 'archived', lockedAt: null, creationCompletedAt: null })
    )
    await open(['storyteller'], 'active')
    fireEvent.press(screen.getByLabelText('Ações do narrador'))
    fireEvent.press(screen.getByTestId('status-archive'))
    expect(calls.statusPost).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Arquivar a ficha? O jogador continua lendo, mas só você muda a ficha.'
      )
    ).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Arquivar' }))
    })
    expect(calls.statusPost).toHaveBeenCalledWith(ID, { status: 'archived' })
    await waitFor(() =>
      expect(screen.getByText('Ficha arquivada.')).toBeTruthy()
    )
  })
})
