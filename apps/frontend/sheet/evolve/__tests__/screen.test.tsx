import { screen } from '@testing-library/react-native'
import { useRouter } from 'expo-router'
import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import { example, templateJson } from '../../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { SheetScreen } from '../../SheetScreen'

// Etapa 18: a ficha recém-criada abre em Evoluir; quem não escreve, não.

jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const ID = '00000000-0000-4000-8000-00000000c001'

beforeEach(() => {
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

const character = (roles: string[]) =>
  ok({
    id: ID,
    name: 'Nova',
    chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
    owner: { id: 'u1', username: 'dona' },
    systemCode: 'vtm-v20',
    templateVersion: '1.0.0',
    sheetVersion: 0,
    roles,
    status: 'creating',
    lockedAt: null,
    member: true,
    updatedAt: '2026-10-18T12:00:00Z',
    sheet: { values: { name: 'Nova', clan: 'tremere' }, specialties: {} },
  })

it('o dono abre a ficha nova em Editar', async () => {
  calls.characterGet.mockResolvedValue(character(['owner']))
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  renderWithSession(
    <SheetScreen id={ID} initialMode="evolve" />,
    await signedIn()
  )
  expect(await screen.findByText('Editando · 0 alterações')).toBeTruthy()
  expect(screen.getByRole('radio', { name: 'Editar' })).toBeChecked()
})

it('sem parâmetro, o dono abre em Jogo (Etapa 17), com o seletor de modo', async () => {
  calls.characterGet.mockResolvedValue(
    ok({
      ...character(['owner']).data,
      sheet: example('helena').sheet,
    })
  )
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  renderWithSession(<SheetScreen id={ID} />, await signedIn())
  expect(await screen.findByRole('radio', { name: 'Jogo' })).toBeChecked()
  // O dono não tem Leitura: Jogo já mostra a ficha inteira
  expect(screen.queryByRole('radio', { name: 'Leitura' })).toBeNull()
})
