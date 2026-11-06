import {
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import type { RoleName } from '@tms/sheet-core'
import type { ReactTestInstance } from 'react-test-renderer'
import * as apiModule from '../../../lib/api'
import { type createFakeApi, ok } from '../../../test/fake-api'
import { sheetFor } from '../../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { costLabel, xpCandidates } from '../candidates'
import { ExperienceSheet } from '../ExperienceSheet'

// "Solicitar evolução" na tela (T-50): a lista agrupada pelo template, com
// busca, a opção marcada e o resumo com "Enviar pedido" no rodapé da folha.

jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

const CHARACTER = '00000000-0000-4000-8000-00000000c001'
const CHRONICLE = '00000000-0000-4000-8000-00000000a001'

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

const balance = (available: number) =>
  ok({
    supported: true,
    balance: { total: available, spent: 0, available },
    items: [],
    next: null,
  })

async function open(
  { available = 20, roles = ['owner'] as RoleName[] } = {},
  system = 'helena'
) {
  calls.xpGet.mockImplementation((async () => balance(available)) as never)
  const { model, sheet } = sheetFor(system, roles)
  renderWithSession(
    <ExperienceSheet
      characterId={CHARACTER}
      chronicleId={CHRONICLE}
      model={model}
      sheet={sheet}
      roles={roles}
      lifecycle={{ status: 'active', locked: false, member: true }}
      visible
      onClose={jest.fn()}
    />,
    await signedIn()
  )
  await waitFor(() =>
    expect(screen.getByText(`Disponível: ${available} XP`)).toBeTruthy()
  )
  return { model, sheet }
}

const ancestors = (node: ReactTestInstance): string[] => {
  const out: string[] = []
  for (let p = node.parent; p; p = p.parent)
    if (typeof p.type === 'string') out.push(p.type)
  return out
}

beforeEach(() => {
  calls.xpRequestPost.mockReset()
})

describe('Solicitar evolução (T-50)', () => {
  it('a busca acha o traço, o toque marca o rádio, e o resumo e "Enviar pedido" ficam no rodapé, fora da rolagem', async () => {
    const { model, sheet } = await open()
    fireEvent.press(screen.getByRole('button', { name: 'Solicitar evolução' }))
    // Sem escolha: o rodapé pede um traço
    const footer = screen.getByTestId('xp-request-footer')
    expect(
      within(footer).getByText('Escolha um traço para ver o custo.')
    ).toBeTruthy()
    // Os blocos com o título do template
    expect(screen.getByLabelText('Talentos')).toBeTruthy()
    expect(screen.getByLabelText('Virtudes')).toBeTruthy()

    fireEvent.changeText(screen.getByLabelText('Buscar traço'), 'brig')
    expect(screen.queryByLabelText('Virtudes')).toBeNull()
    const brawl = xpCandidates(model, sheet).find(
      c => c.target.field === 'brawl'
    )
    if (!brawl?.cost.ok) throw new Error('Briga sem custo')
    const radio = screen.getByRole('radio', {
      name: `Briga, ${costLabel(brawl)}`,
    })
    fireEvent.press(radio)
    expect(radio.props.accessibilityState).toMatchObject({ checked: true })

    const summary = within(footer).getByTestId('xp-request-summary')
    expect(summary).toHaveTextContent(
      `Briga: ${brawl.cost.from} → ${brawl.cost.to}. Custo ${brawl.cost.cost} XP (disponível 20).`
    )
    const send = within(footer).getByRole('button', { name: 'Enviar pedido' })
    // O rodapé não está dentro da rolagem da folha
    expect(ancestors(send)).not.toContain('RCTScrollView')
    expect(ancestors(radio)).toContain('RCTScrollView')

    calls.xpRequestPost.mockResolvedValue(ok({ id: 'r1' }))
    fireEvent.press(send)
    await waitFor(() => expect(calls.xpRequestPost).toHaveBeenCalledTimes(1))
    expect(calls.xpRequestPost.mock.calls[0]?.[1]).toMatchObject({
      field: 'brawl',
      to: brawl.cost.to,
      expectedCost: brawl.cost.cost,
    })
    // Enviado: a lista fecha
    await waitFor(() =>
      expect(screen.queryByTestId('xp-request-footer')).toBeNull()
    )
  })

  it('a escolha é uma só: marcar em outro bloco desmarca o anterior', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Solicitar evolução' }))
    const talents = screen.getByLabelText('Talentos')
    const virtues = screen.getByLabelText('Virtudes')
    const [first] = within(talents).getAllByRole('radio')
    const [other] = within(virtues).getAllByRole('radio')
    if (!first || !other) throw new Error('sem opções')
    fireEvent.press(first)
    fireEvent.press(other)
    expect(
      within(talents)
        .getAllByRole('radio')
        .map(r => r.props.accessibilityState?.checked)
    ).not.toContain(true)
    expect(
      within(virtues).getAllByRole('radio')[0]?.props.accessibilityState
    ).toMatchObject({ checked: true })
  })

  it('sem resultado, a busca diz o que não achou', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Solicitar evolução' }))
    fireEvent.changeText(screen.getByLabelText('Buscar traço'), 'zzzz')
    expect(screen.getByText('Nada encontrado para “zzzz”.')).toBeTruthy()
  })
})
