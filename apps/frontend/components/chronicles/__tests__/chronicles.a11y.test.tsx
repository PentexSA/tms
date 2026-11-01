import { screen } from '@testing-library/react-native'

import { type createFakeApi, ok } from '../../../test/fake-api'
import { templateJson } from '../../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { CreationSettings } from '../CreationSettings'
import { InviteSheet } from '../InviteSheet'
import { RollFeed } from '../RollFeed'

// Acessibilidade das telas da crônica (P06 da onda 1): um teste de regressão
// por bug.

jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})
const calls = (
  jest.requireMock('../../../lib/api') as {
    fake: ReturnType<typeof createFakeApi>
  }
).fake.calls

const CHRONICLE = '00000000-0000-4000-8000-0000000000c1'

beforeEach(() => {
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
})

async function renderSettings() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  renderWithSession(
    <CreationSettings
      chronicleId={CHRONICLE}
      systemCode="vtm-v20"
      creation={{ approval: false, defaults: {}, revision: 3 }}
    />,
    session
  )
  await screen.findByTestId('creation-settings-budgets')
}

const VTM = { code: 'vtm-v20', name: 'Vampiro: A Máscara', family: 'wod' }

async function renderRolls() {
  calls.chronicle.get.mockResolvedValue(
    ok({
      id: CHRONICLE,
      name: 'Crônica de teste',
      system: VTM,
      role: 'storyteller',
      storyteller: { id: 'u1', username: 'ana' },
      members: [],
    })
  )
  calls.chronicle.charactersGet.mockResolvedValue(ok([]))
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  renderWithSession(<RollFeed chronicleId={CHRONICLE} />, session)
  await screen.findByRole('button', { name: 'Rolar' })
}

describe('Regras da crônica: título visível nos grupos de escolha (T-09)', () => {
  it('"Aprovação do narrador" e "Modo padrão" aparecem na tela', async () => {
    await renderSettings()
    expect(screen.getByText('Aprovação do narrador')).toBeTruthy()
    expect(screen.getByText('Modo padrão')).toBeTruthy()
  })
})

describe('Stepper lê o número, não a porcentagem (T-34)', () => {
  it('Primária 7 do orçamento (0 a 1000) tem o texto "7"', async () => {
    await renderSettings()
    expect(
      screen.getByRole('adjustable', { name: 'Atributos, Primária' })
    ).toHaveAccessibilityValue({ text: '7', min: 0, max: 1000, now: 7 })
  })
})

describe('Mesa › Rolagens: rótulo visível nos steppers (T-09)', () => {
  it('"Dados" e "Dificuldade" aparecem acima dos controles', async () => {
    await renderRolls()
    expect(
      screen.getByText('Dados', { includeHiddenElements: true })
    ).toBeTruthy()
    expect(
      screen.getByText('Dificuldade', { includeHiddenElements: true })
    ).toBeTruthy()
    // O controle continua com o nome; o rótulo visível não é lido duas vezes
    expect(screen.getByRole('adjustable', { name: 'Dificuldade' })).toBeTruthy()
    expect(screen.queryByText('Dificuldade')).toBeNull()
  })
})

/** Algum ancestral de host é um elemento acessível (engole os filhos no app)? */
const insideAccessible = (el: { parent: unknown }): boolean => {
  type Node = {
    type?: unknown
    props?: { accessible?: boolean }
    parent: unknown
  }
  let node = el.parent as Node | null
  while (node) {
    if (typeof node.type === 'string' && node.props?.accessible === true)
      return true
    node = node.parent as Node | null
  }
  return false
}

describe('Convites ativos: Revogar alcançável no leitor de tela (T-41)', () => {
  it('o botão fica fora da linha acessível do convite', async () => {
    calls.chronicle.invitesGet.mockResolvedValue(
      ok([
        {
          id: 'i1',
          createdAt: '2026-10-18T12:00:00Z',
          expiresAt: '2026-10-25T12:00:00Z',
          maxUses: 10,
          uses: 2,
          active: true,
        },
      ])
    )
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(
      <InviteSheet
        chronicleId={CHRONICLE}
        chronicleName="Crônica de teste"
        visible
        onClose={jest.fn()}
      />,
      session
    )
    const revoke = await screen.findByRole('button', { name: 'Revogar' })
    expect(insideAccessible(revoke)).toBe(false)
    expect(
      screen.getByLabelText(/^Criado em .*, 8 usos restantes/)
    ).toBeTruthy()
  })
})
