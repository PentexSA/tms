import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import { AccessibilityInfo } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, fail, ok } from '../../../test/fake-api'
import { sheetFor, templateJson } from '../../../test/fixtures'
import { sheetsDismissed } from '../../../test/queries'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { SheetScreen } from '../../SheetScreen'
import {
  lowerDone,
  npcVisibilityOf,
  REVEAL_COPY,
  revealsMore,
} from '../RevealNpcSheet'

// T-46: revelar o NPC pede confirmação, e o toast vem depois da folha sair.
// Descer envia direto. O rádio só muda com a resposta do servidor.

jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})
jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-0000000000aa',
}))
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

const NPC = '00000000-0000-4000-8000-00000000c009'
const WAIT = { timeout: 5000 }

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined)
  jest.mocked(useRouter).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  } as never)
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

const npc = (visibility: 'hidden' | 'identity' | 'full', revision = 2) =>
  ok({
    projection: 'full',
    id: NPC,
    kind: 'npc',
    visibility,
    visibilityRevision: revision,
    presentationRevision: 0,
    identity: {
      name: 'Oráculo',
      chip: null,
      subtitle: null,
      portraitUrl: null,
    },
    name: 'Oráculo',
    chronicle: { id: 'c1', name: 'Crônica de teste' },
    owner: { id: 'u1', username: 'ana' },
    systemCode: 'vtm-v20',
    templateVersion: '1.0.0',
    sheetVersion: 3,
    roles: ['storyteller'],
    status: 'active',
    lockedAt: null,
    member: true,
    updatedAt: '2026-10-18T12:00:00Z',
    sheet: sheetFor('helena', ['storyteller']).sheet,
  })

async function open(visibility: 'hidden' | 'identity' | 'full') {
  calls.characterGet.mockResolvedValue(npc(visibility))
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  renderWithSession(<SheetScreen id={NPC} />, await signedIn())
  await screen.findByRole('radio', { name: /^Oculto/ }, WAIT)
}

const radio = (name: RegExp) => screen.getByRole('radio', { name })

describe('regras da revelação', () => {
  it('subir na ordem do sigilo pede confirmação; descer, não', () => {
    expect(revealsMore('hidden', 'identity')).toBe(true)
    expect(revealsMore('hidden', 'full')).toBe(true)
    expect(revealsMore('identity', 'full')).toBe(true)
    expect(revealsMore('full', 'identity')).toBe(false)
    expect(revealsMore('identity', 'hidden')).toBe(false)
    expect(revealsMore('full', 'hidden')).toBe(false)
  })

  it('valor desconhecido da API conta como oculto (toda troca confirma)', () => {
    expect(npcVisibilityOf('identity')).toBe('identity')
    expect(npcVisibilityOf('full')).toBe('full')
    expect(npcVisibilityOf('hidden')).toBe('hidden')
    expect(npcVisibilityOf('outro')).toBe('hidden')
    expect(npcVisibilityOf(null)).toBe('hidden')
  })

  it('os textos dizem que quem já viu continua sabendo', () => {
    for (const copy of Object.values(REVEAL_COPY))
      expect(copy.body('Oráculo')).toContain('Quem já viu continua sabendo')
    expect(REVEAL_COPY.full.body('Oráculo')).toContain(
      'sem as Notas do Narrador'
    )
    expect(lowerDone('identity', 'Oráculo')).toBe(
      'Agora os jogadores veem só a identidade. Quem já abriu a ficha continua sabendo.'
    )
    expect(lowerDone('hidden', 'Oráculo')).toBe(
      'Oráculo voltou a ficar oculto. Quem já viu continua sabendo.'
    )
  })
})

describe('Visibilidade do NPC: confirmar antes de revelar (T-46)', () => {
  it('"Identidade" abre a confirmação sem chamar a API; Cancelar mantém Oculto', async () => {
    await open('hidden')
    fireEvent.press(radio(/^Identidade/))
    expect(
      screen.getByRole('header', {
        name: 'Revelar a identidade para os jogadores?',
      })
    ).toBeTruthy()
    expect(screen.getByText(/o retrato de Oráculo/)).toBeTruthy()
    expect(calls.visibilityPost).not.toHaveBeenCalled()

    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    await sheetsDismissed()
    expect(calls.visibilityPost).not.toHaveBeenCalled()
    expect(radio(/^Oculto/)).toBeChecked()
    expect(screen.queryByText('Identidade revelada aos jogadores.')).toBeNull()
  })

  it('"Revelar identidade" envia com a revisão e o toast vem depois da folha sair', async () => {
    calls.visibilityPost.mockResolvedValue(
      ok({ visibility: 'identity', visibilityRevision: 3 })
    )
    await open('hidden')
    fireEvent.press(radio(/^Identidade/))
    calls.characterGet.mockResolvedValue(npc('identity', 3))
    fireEvent.press(screen.getByRole('button', { name: 'Revelar identidade' }))
    await waitFor(() => expect(calls.visibilityPost).toHaveBeenCalledTimes(1))
    expect(calls.visibilityPost).toHaveBeenCalledWith(NPC, {
      visibility: 'identity',
      revision: 2,
      clientCommandId: '00000000-0000-4000-8000-0000000000aa',
    })
    // A folha fecha; o toast espera a animação de saída
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Revelar identidade' })
      ).toBeNull()
    )
    expect(screen.queryByText('Identidade revelada aos jogadores.')).toBeNull()
    await sheetsDismissed()
    expect(
      await screen.findByText('Identidade revelada aos jogadores.')
    ).toBeTruthy()
    await waitFor(() => expect(radio(/^Identidade/)).toBeChecked())
  })

  it('"Ficha" abre a confirmação da ficha', async () => {
    await open('identity')
    fireEvent.press(radio(/^Ficha/))
    expect(
      screen.getByRole('header', { name: 'Revelar a ficha para os jogadores?' })
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Revelar ficha' })).toBeTruthy()
    expect(calls.visibilityPost).not.toHaveBeenCalled()
  })

  it('descer envia direto, sem folha, com o aviso de que quem viu continua sabendo', async () => {
    calls.visibilityPost.mockResolvedValue(
      ok({ visibility: 'hidden', visibilityRevision: 3 })
    )
    await open('identity')
    fireEvent.press(radio(/^Oculto/))
    expect(screen.queryByRole('button', { name: /^Revelar/ })).toBeNull()
    await waitFor(() => expect(calls.visibilityPost).toHaveBeenCalledTimes(1))
    expect(calls.visibilityPost.mock.calls[0]![1]).toMatchObject({
      visibility: 'hidden',
    })
    expect(
      await screen.findByText(
        'Oráculo voltou a ficar oculto. Quem já viu continua sabendo.'
      )
    ).toBeTruthy()
  })

  it('o 409 (revisão velha) aparece dentro da folha e rebusca a ficha; nada é revelado', async () => {
    calls.visibilityPost.mockResolvedValue(
      fail(409, 'Os dados mudaram. Atualize para continuar.')
    )
    await open('hidden')
    const reads = calls.characterGet.mock.calls.length
    fireEvent.press(radio(/^Identidade/))
    fireEvent.press(screen.getByRole('button', { name: 'Revelar identidade' }))
    expect(
      await screen.findByText('Os dados mudaram. Atualize para continuar.')
    ).toBeTruthy()
    // A folha continua aberta, com o erro dentro dela
    expect(
      screen.getByRole('button', { name: 'Revelar identidade' })
    ).toBeTruthy()
    await waitFor(() =>
      expect(calls.characterGet.mock.calls.length).toBeGreaterThan(reads)
    )
    expect(radio(/^Oculto/)).toBeChecked()
    await act(async () => undefined)
  })
})
