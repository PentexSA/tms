import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import * as apiModule from '../../lib/api'
import { SheetScreen } from '../../sheet/SheetScreen'
import { type createFakeApi, ok } from '../../test/fake-api'
import { example, templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen from '../(app)/chronicles/[id]/index'
import HomeScreen from '../(app)/index'

// v3, Etapa 7: remover jogador, sair da crônica e o ex-membro ("Você saiu"),
// que lê só as fichas dele, em Leitura.

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})

const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const CHRONICLE_ID = '00000000-0000-4000-8000-0000000000c1'
const HELENA = '00000000-0000-4000-8000-00000000c001'
const VTM = { code: 'vtm-v20', name: 'Vampiro: A Máscara', family: 'wod' }

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE_ID })
  calls.templateGet.mockImplementation(async (code: string) =>
    ok(templateJson(code))
  )
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await session.restore()
  return session
}

const detail = (role: 'storyteller' | 'player' | 'former') =>
  ok({
    id: CHRONICLE_ID,
    name: 'Crônica da Liberdade',
    system: VTM,
    role,
    storyteller: { id: 'u1', username: 'ana' },
    members:
      role === 'former'
        ? []
        : [
            {
              id: 'u2',
              username: 'dona',
              joinedAt: '2026-10-01T12:00:00Z',
            },
          ],
  })

const helena = (mine: boolean) => {
  const values = example('helena').sheet.values
  return {
    id: HELENA,
    name: 'Helena Varga',
    owner: { id: 'u2', username: 'dona' },
    mine,
    templateVersion: '1.0.0',
    updatedAt: '2026-10-18T12:00:00Z',
    values: { name: values.name, clan: values.clan },
  }
}

async function openChronicle(role: 'storyteller' | 'player' | 'former') {
  calls.chronicle.get.mockResolvedValue(detail(role))
  calls.chronicle.charactersGet.mockResolvedValue(
    ok([helena(role !== 'storyteller')])
  )
  renderWithSession(<ChronicleScreen />, await signedIn())
  expect((await screen.findAllByText('Helena Varga')).length).toBeGreaterThan(0)
}

describe('o ex-membro', () => {
  it('a crônica "Você saiu" abre só as fichas dele, sem Nova ficha, convites nem membros', async () => {
    await openChronicle('former')
    expect(screen.getByTestId('former-banner')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Nova ficha' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Convidar' })).toBeNull()
    expect(screen.queryByText('Participantes')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sair da crônica' })).toBeNull()
  })

  it('a lista de crônicas marca "Você saiu"', async () => {
    calls.chroniclesGet.mockResolvedValue(
      ok([
        {
          id: CHRONICLE_ID,
          name: 'Crônica da Liberdade',
          system: VTM,
          role: 'former',
          storyteller: { username: 'ana' },
          characterCount: 1,
        },
      ])
    )
    renderWithSession(<HomeScreen />, await signedIn())
    expect(await screen.findByText('Você saiu · 1 personagem')).toBeTruthy()
  })

  it('a ficha dele abre em Leitura, com o aviso, sem o seletor de modo', async () => {
    calls.characterGet.mockResolvedValue(
      ok({
        id: HELENA,
        name: 'Helena Varga',
        chronicle: { id: CHRONICLE_ID, name: 'Crônica da Liberdade' },
        owner: { id: 'u2', username: 'dona' },
        systemCode: 'vtm-v20',
        templateVersion: '1.0.0',
        sheetVersion: 3,
        roles: ['owner'],
        status: 'archived',
        lockedAt: null,
        member: false,
        updatedAt: '2026-10-18T12:00:00Z',
        sheet: example('helena').sheet,
      })
    )
    renderWithSession(<SheetScreen id={HELENA} />, await signedIn())
    expect(await screen.findByText('Você saiu desta crônica')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Editar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dados' })).toBeNull()
  })
})

describe('o narrador remove um jogador', () => {
  it('a lista mostra a data de entrada e as fichas de cada membro', async () => {
    await openChronicle('storyteller')
    expect(await screen.findByText(/^Jogador · entrou em /)).toBeTruthy()
    expect(screen.getAllByText('Helena Varga').length).toBe(2)
  })

  it('confirma, revogando os convites por padrão', async () => {
    calls.chronicle.memberDelete.mockResolvedValue(ok(null))
    await openChronicle('storyteller')
    fireEvent.press(screen.getByTestId('remove-u2'))
    expect(screen.getByRole('header', { name: 'Remover dona' })).toBeTruthy()
    expect(calls.chronicle.memberDelete).not.toHaveBeenCalled()
    await act(async () => {
      // O da folha de confirmação (o da linha vem antes)
      fireEvent.press(
        screen.getAllByRole('button', { name: 'Remover' }).at(-1)!
      )
    })
    expect(calls.chronicle.memberDelete).toHaveBeenCalledWith('u2', {
      revokeInvites: true,
    })
    expect(await screen.findByText('dona saiu da crônica.')).toBeTruthy()
  })

  it('pode manter os convites', async () => {
    calls.chronicle.memberDelete.mockResolvedValue(ok(null))
    await openChronicle('storyteller')
    fireEvent.press(screen.getByTestId('remove-u2'))
    fireEvent.press(screen.getByRole('radio', { name: 'Manter os convites' }))
    await act(async () => {
      // O da folha de confirmação (o da linha vem antes)
      fireEvent.press(
        screen.getAllByRole('button', { name: 'Remover' }).at(-1)!
      )
    })
    expect(calls.chronicle.memberDelete).toHaveBeenCalledWith('u2', {
      revokeInvites: false,
    })
  })
})

describe('o jogador sai', () => {
  it('confirma e volta para a lista de crônicas', async () => {
    calls.chronicle.leaveDelete.mockResolvedValue(ok(null))
    await openChronicle('player')
    fireEvent.press(screen.getByRole('button', { name: 'Sair da crônica' }))
    expect(calls.chronicle.leaveDelete).not.toHaveBeenCalled()
    const confirm = screen.getAllByRole('button', { name: 'Sair da crônica' })
    await act(async () => {
      fireEvent.press(confirm[confirm.length - 1]!)
    })
    expect(calls.chronicle.leaveDelete).toHaveBeenCalled()
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'))
  })

  it('o narrador não tem "Sair da crônica"', async () => {
    await openChronicle('storyteller')
    expect(screen.queryByRole('button', { name: 'Sair da crônica' })).toBeNull()
  })
})
