import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import type { RoleName } from '@tms/sheet-core'
import { useState } from 'react'
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

// O custo e o "para" saem da ficha de agora, não da hora do toque
describe('a ficha muda com a folha aberta', () => {
  it('o resumo e o pedido usam o custo da ficha nova (sem expectedCost velho)', async () => {
    calls.xpGet.mockImplementation((async () => balance(50)) as never)
    calls.xpRequestPost.mockResolvedValue(ok({ id: 'r1' }))
    const { model, sheet } = sheetFor('helena', ['owner'])
    let update: (next: typeof sheet) => void = () => undefined
    function Harness() {
      const [current, setCurrent] = useState(sheet)
      update = setCurrent
      return (
        <ExperienceSheet
          characterId={CHARACTER}
          chronicleId={CHRONICLE}
          model={model}
          sheet={current}
          roles={['owner']}
          lifecycle={{ status: 'active', locked: false, member: true }}
          visible
          onClose={jest.fn()}
        />
      )
    }
    renderWithSession(<Harness />, await signedIn())
    await waitFor(() =>
      expect(screen.getByText('Disponível: 50 XP')).toBeTruthy()
    )
    fireEvent.press(screen.getByRole('button', { name: 'Solicitar evolução' }))
    fireEvent.changeText(screen.getByLabelText('Buscar traço'), 'brig')
    fireEvent.press(screen.getByRole('radio', { name: /^Briga, / }))
    // O narrador aprovou outro pedido: a Briga subiu na ficha confirmada
    const raised = {
      ...sheet,
      values: { ...sheet.values, brawl: 2 },
    } as typeof sheet
    const next = xpCandidates(model, raised).find(
      c => c.target.field === 'brawl'
    )
    if (!next?.cost.ok) throw new Error('Briga sem custo')
    act(() => update(raised))
    expect(screen.getByTestId('xp-request-summary')).toHaveTextContent(
      `Briga: 2 → 3. Custo ${next.cost.cost} XP (disponível 50).`
    )
    fireEvent.press(screen.getByRole('button', { name: 'Enviar pedido' }))
    await waitFor(() => expect(calls.xpRequestPost).toHaveBeenCalledTimes(1))
    expect(calls.xpRequestPost.mock.calls[0]?.[1]).toMatchObject({
      field: 'brawl',
      to: 3,
      expectedCost: next.cost.cost,
    })
  })
})

// U-01: o atalho abre a folha já no pedido
describe('aberta pelo atalho (U-01)', () => {
  const render = async (
    initial: Parameters<typeof ExperienceSheet>[0]['initial']
  ) => {
    calls.xpGet.mockImplementation((async () => balance(20)) as never)
    const { model, sheet } = sheetFor('helena', ['owner'])
    renderWithSession(
      <ExperienceSheet
        characterId={CHARACTER}
        chronicleId={CHRONICLE}
        model={model}
        sheet={sheet}
        roles={['owner']}
        lifecycle={{ status: 'active', locked: false, member: true }}
        visible
        onClose={jest.fn()}
        initial={initial}
      />,
      await signedIn()
    )
  }

  it('com o traço: a lista aberta, o rádio marcado e o resumo no rodapé', async () => {
    await render({ target: { field: 'dexterity' } })
    const radio = await screen.findByRole('radio', { name: /^Destreza, / })
    expect(radio.props.accessibilityState).toMatchObject({ checked: true })
    expect(screen.getByTestId('xp-request-summary')).toHaveTextContent(
      /^Destreza: /
    )
  })

  it('com a busca: a lista filtrada, sem escolha', async () => {
    await render({ query: 'Disciplinas', field: 'disciplines' })
    expect(await screen.findByLabelText('Buscar traço')).toHaveProp(
      'value',
      'Disciplinas'
    )
    expect(screen.queryByLabelText('Talentos')).toBeNull()
    expect(screen.queryByTestId('xp-request-summary')).toBeNull()
  })
})

// T-77: o que o servidor recusaria fica bloqueado com o motivo, tocável
describe('"Enviar pedido" bloqueado com o motivo (T-77)', () => {
  const brawlOf = () => {
    const { model, sheet } = sheetFor('helena', ['owner'])
    const brawl = xpCandidates(model, sheet).find(
      c => c.target.field === 'brawl'
    )
    if (!brawl?.cost.ok) throw new Error('Briga sem custo')
    return brawl as typeof brawl & { cost: { ok: true; cost: number } }
  }

  it('acima do saldo: a opção e o botão bloqueados; o toque mostra o motivo, pede o saldo de novo e não chama a API; com o saldo novo, o botão se libera', async () => {
    const brawl = brawlOf()
    const short = brawl.cost.cost - 1
    await open({ available: short })
    fireEvent.press(screen.getByRole('button', { name: 'Solicitar evolução' }))
    fireEvent.changeText(screen.getByLabelText('Buscar traço'), 'brig')
    const radio = screen.getByRole('radio', { name: /^Briga, / })
    expect(radio.props.accessibilityLabel).toContain('faltam 1')
    expect(radio.props.accessibilityState).toMatchObject({ disabled: true })
    // Tocável: a opção é marcada
    fireEvent.press(radio)
    expect(
      screen.getByRole('radio', { name: /^Briga, / }).props.accessibilityState
    ).toMatchObject({ checked: true })

    const footer = screen.getByTestId('xp-request-footer')
    const reason = `Faltam 1 XP (custa ${brawl.cost.cost}, disponível ${short}).`
    expect(within(footer).getByTestId('xp-request-refusal')).toHaveTextContent(
      reason
    )
    const send = within(footer).getByRole('button', { name: 'Enviar pedido' })
    expect(send.props.accessibilityState).toMatchObject({ disabled: true })
    const fetched = calls.xpGet.mock.calls.length
    // O narrador concedeu XP enquanto a folha estava aberta
    calls.xpGet.mockImplementation((async () =>
      balance(brawl.cost.cost)) as never)
    fireEvent.press(send)
    expect(calls.xpRequestPost).not.toHaveBeenCalled()
    expect(within(footer).getByRole('alert')).toHaveTextContent(reason)
    await waitFor(() =>
      expect(calls.xpGet.mock.calls.length).toBeGreaterThan(fetched)
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Enviar pedido' }).props
          .accessibilityState
      ).toMatchObject({ disabled: false })
    )
    expect(screen.queryByTestId('xp-request-refusal')).toBeNull()
  })

  it('sem escolha, o toque no bloqueado diz o motivo e não refaz o extrato', async () => {
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Solicitar evolução' }))
    const fetched = calls.xpGet.mock.calls.length
    fireEvent.press(screen.getByRole('button', { name: 'Enviar pedido' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escolha um traço para ver o custo.'
    )
    // Deixa sair qualquer rebusca pendente antes de contar
    await act(async () => {
      await Promise.resolve()
    })
    expect(calls.xpGet.mock.calls.length).toBe(fetched)
  })

  // P13 (§11.6, ponto 4; decisão do PO): o pendente é igual ao acima do
  // saldo. Bloqueado (aria-disabled, sem `disabled`), tocável, e o toque diz
  // o motivo com a frase da recusa do servidor; "Enviar pedido" não envia
  it('pedido pendente do mesmo traço: bloqueado e tocável, com o motivo', async () => {
    calls.xpRequestsGet.mockImplementation((async () =>
      ok({
        items: [
          {
            id: 'r1',
            characterId: CHARACTER,
            field: 'brawl',
            item: null,
            name: null,
            label: 'Briga',
            from: 0,
            to: 1,
            cost: 3,
            status: 'pending',
            reason: null,
          },
        ],
      })) as never)
    await open()
    fireEvent.press(screen.getByRole('button', { name: 'Solicitar evolução' }))
    fireEvent.changeText(screen.getByLabelText('Buscar traço'), 'brig')
    const radio = screen.getByRole('radio', { name: /pedido pendente$/ })
    expect(radio.props.accessibilityState).toMatchObject({ disabled: true })
    expect(radio.props.disabled).toBeUndefined()
    fireEvent.press(radio)
    expect(
      screen.getByRole('radio', { name: /pedido pendente$/ }).props
        .accessibilityState
    ).toMatchObject({ checked: true })
    const footer = screen.getByTestId('xp-request-footer')
    const reason = 'Já existe um pedido pendente para este traço.'
    expect(within(footer).getByTestId('xp-request-refusal')).toHaveTextContent(
      reason
    )
    fireEvent.press(
      within(footer).getByRole('button', { name: 'Enviar pedido' })
    )
    expect(calls.xpRequestPost).not.toHaveBeenCalled()
    expect(within(footer).getByRole('alert')).toHaveTextContent(reason)
    calls.xpRequestsGet.mockImplementation((async () =>
      ok({ items: [] })) as never)
  })
})
