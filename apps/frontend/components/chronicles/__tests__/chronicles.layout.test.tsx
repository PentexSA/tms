import { screen } from '@testing-library/react-native'
import { tokens } from '@tms/ui'
import { StyleSheet } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import { renderWithQueryClient } from '../../../test/utils'
import { CampaignBackstage } from '../CampaignBackstage'
import { RollFeed } from '../RollFeed'

// P08 (onda 2), T-67: os títulos dos Bastidores e da Mesa ficam com a
// margem da página, como os da lista de fichas. O SectionHeader não tem
// recuo próprio: quem o usa põe o invólucro.

jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000001',
}))
jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})

const { chronicle } = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const ID = '00000000-0000-4000-8000-0000000000c1'

const gutterOf = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style)?.paddingHorizontal

beforeEach(() => {
  chronicle.charactersGet.mockResolvedValue(ok([]))
})

describe('T-67: títulos com a margem da página', () => {
  it('Bastidores: Diário, Apresentação, Transferir narração e Auditoria', async () => {
    renderWithQueryClient(
      <CampaignBackstage
        chronicle={{
          id: ID,
          name: 'Crônica da Liberdade',
          description: '',
          imageUrl: null,
          settingsRevision: 1,
          members: [],
        }}
        narrating
      />
    )
    expect(
      await screen.findByRole('header', { name: 'Diário da crônica' })
    ).toBeTruthy()
    for (const id of [
      'backstage-header-diary',
      'backstage-header-presentation',
      'backstage-header-transfer',
      'backstage-header-audit',
    ])
      expect(gutterOf(id)).toBe(tokens.layout.gutter)
  })

  it('Mesa: Rolagens da mesa', async () => {
    renderWithQueryClient(<RollFeed chronicleId={ID} />)
    expect(
      await screen.findByRole('header', { name: 'Rolagens da mesa' })
    ).toBeTruthy()
    expect(gutterOf('roll-feed-header')).toBe(tokens.layout.gutter)
  })
})
