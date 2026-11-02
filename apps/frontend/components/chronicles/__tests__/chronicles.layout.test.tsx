import { render, screen, within } from '@testing-library/react-native'
import { tokens } from '@tms/ui'
import { StyleSheet } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import { example, modelOf, sheetFor } from '../../../test/fixtures'
import { renderWithQueryClient } from '../../../test/utils'
import { CampaignBackstage } from '../CampaignBackstage'
import { RollFeed } from '../RollFeed'
import { TableRow } from '../TableRow'
import { buildItem } from '../tableItems'

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

// T-48 (P09-C): o cartão da Mesa compacto, com os recursos numa linha
describe('T-48: cartão da Mesa', () => {
  const HELENA = '00000000-0000-4000-8000-00000000c001'
  const item = () => {
    const c = example('helena')
    return buildItem(
      {
        id: HELENA,
        name: String(c.sheet.values.name),
        owner: { id: 'u-dona', username: 'dona' },
        systemCode: 'vtm-v20',
        templateVersion: '1.0.0',
        sheetVersion: 2,
        status: 'creating',
        updatedAt: new Date().toISOString(),
        sheet: sheetFor('helena', ['storyteller']).sheet,
      },
      modelOf('vtm-v20')
    )
  }
  const flat = (el: { props: { style?: unknown } }) =>
    StyleSheet.flatten(el.props.style as never) ?? {}

  it('os recursos numa linha, cada um com a mesma fração da largura', () => {
    render(<TableRow item={item()} onOpen={jest.fn()} />)
    const dock = screen.getByTestId(`table-dock-${HELENA}`)
    expect(flat(dock).flexDirection).toBe('row')
    const cells = dock.children as unknown as { props: { style?: unknown } }[]
    expect(cells).toHaveLength(modelOf('vtm-v20').template.dock.length)
    for (const cell of cells)
      expect(flat(cell)).toMatchObject({ flex: 1, minWidth: 0 })
    // O dock fica fora da coluna de texto: na largura inteira do cartão
    const card = screen.getByTestId(`table-row-${HELENA}`)
    expect(flat(card).flexDirection).not.toBe('row')
    // A linha de selos (o estado) fica entre o texto e os recursos
    expect(
      within(screen.getByTestId(`table-badges-${HELENA}`)).getByText(
        'Em criação'
      )
    ).toBeTruthy()
  })

  it('na grade, o cartão tem borda e raio; na coluna, o separador', () => {
    const { rerender } = render(
      <TableRow item={item()} onOpen={jest.fn()} framed />
    )
    const framed = flat(screen.getByTestId(`table-row-${HELENA}`))
    expect(framed.borderWidth).toBe(tokens.borderWidth.hair)
    expect(framed.borderRadius).toBe(tokens.radius.md)
    rerender(<TableRow item={item()} onOpen={jest.fn()} />)
    const listed = flat(screen.getByTestId(`table-row-${HELENA}`))
    expect(listed.borderRadius).toBeUndefined()
    expect(listed.borderBottomWidth).toBe(tokens.borderWidth.hair)
  })
})
