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

describe('Regras da crônica: título visível nos grupos de escolha (T-09)', () => {
  it('"Aprovação do narrador" e "Modo padrão" aparecem na tela', async () => {
    await renderSettings()
    expect(screen.getByText('Aprovação do narrador')).toBeTruthy()
    expect(screen.getByText('Modo padrão')).toBeTruthy()
  })
})
