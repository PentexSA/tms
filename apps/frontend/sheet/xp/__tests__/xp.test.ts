import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { compileTemplate, type SheetData } from '@tms/sheet-core'
import { createElement } from 'react'
import { Pressable, Text } from 'react-native'
import type { useXpCommands } from '../../../lib/queries/xp'
import { modelOf } from '../../../test/fixtures'
import { canEditIn } from '../../evolve/hooks'
import { costLabel, xpCandidates } from '../candidates'
import { requestBlock } from '../ExperienceSheet'
import { useCommand, xpCommand } from '../forms'
import { ledgerMessage, xpCodeOf, xpMessage } from '../messages'

const template = require('../../../../../design/templates/testes/acct-teste.json')
const model = compileTemplate(template)
const sheet: SheetData = {
  values: { str: 2, xpTotal: 10, xpSpent: 0 },
  specialties: {},
}

const error = (code: string, extra: Record<string, unknown> = {}) => ({
  status: 409,
  value: { code, ...extra },
})

describe('alvos, saldo e proteção do editor', () => {
  it('oferece alvos/custos do core e nada em sistema sem costs.xp', () => {
    const strength = xpCandidates(model, sheet).find(
      c => c.target.field === 'str'
    )
    expect(strength?.cost).toMatchObject({ ok: true, from: 2, to: 3, cost: 8 })
    expect(strength && costLabel(strength)).toBe('2 → 3 · 8 XP')
    expect(xpCandidates(modelOf('dnd5e-2014'), sheet)).toEqual([])
  })

  it('nem o narrador edita as projeções do extrato pelo editor comum', () => {
    expect(
      canEditIn(model, new Set(['storyteller']), 'xpTotal', 'evolve')
    ).toBe(false)
    expect(canEditIn(model, new Set(['storyteller']), 'str', 'evolve')).toBe(
      true
    )
  })

  it('explica estado, vínculo e trava antes de oferecer um pedido', () => {
    expect(
      requestBlock({ status: 'active', locked: false, member: true })
    ).toBeNull()
    expect(
      requestBlock({ status: 'pending', locked: false, member: true })
    ).toContain('aguarda aprovação')
    expect(
      requestBlock({ status: 'active', locked: true, member: true })
    ).toContain('travou a ficha')
    expect(
      requestBlock({ status: 'active', locked: false, member: false })
    ).toContain('só leitura')
  })
})

describe('mensagens do contrato', () => {
  it('distingue projeção fechada por papel', () => {
    expect(ledgerMessage(false)).toContain('envie um pedido')
    expect(ledgerMessage(true)).toContain('Ajustar XP')
  })

  it('mostra saldo, suspensão, stale e pending sem refletir texto hostil', () => {
    expect(xpCodeOf(error('XP_INSUFFICIENT_BALANCE'))).toBe(
      'XP_INSUFFICIENT_BALANCE'
    )
    expect(
      xpMessage(error('XP_INSUFFICIENT_BALANCE', { available: 3, cost: 8 }))
    ).toContain('disponível 3, custo 8')
    expect(xpMessage(error('XP_TARGET_UNAVAILABLE'))).toContain('suspenso')
    expect(xpMessage(error('XP_REQUEST_STALE'))).toContain(
      'Faça um novo pedido'
    )
    expect(
      xpMessage(error('SHEET_NOT_EDITABLE', { reason: 'pending' }))
    ).toContain('aguarda aprovação')
    expect(xpCodeOf(error('<script>'))).toBeNull()
  })
})

function CommandHarness({
  commands,
}: {
  readonly commands: ReturnType<typeof useXpCommands>
}) {
  const run = useCommand(commands, false)
  return createElement(
    Pressable,
    {
      accessibilityRole: 'button',
      accessibilityLabel: 'Enviar',
      onPress: () =>
        void run.send(key =>
          xpCommand('request', key, {
            chronicleId: '00000000-0000-4000-8000-000000000001',
            characterId: '00000000-0000-4000-8000-000000000002',
            body: { field: 'str', to: 3 },
            label: 'Pedir Força',
          })
        ),
    },
    createElement(Text, null, 'Enviar')
  )
}

describe('resultado desconhecido', () => {
  it('reenvia a mesma intenção com a mesma chave', async () => {
    const run = jest
      .fn()
      .mockResolvedValueOnce({ status: 'unknown' })
      .mockResolvedValueOnce({ status: 'done', data: {} })
    const commands = {
      unconfirmed: [],
      run,
      refresh: jest.fn(),
    } as ReturnType<typeof useXpCommands>
    render(createElement(CommandHarness, { commands }))

    fireEvent.press(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2))

    expect(run.mock.calls[1]?.[0].key).toBe(run.mock.calls[0]?.[0].key)
    expect(run.mock.calls[1]?.[0].body).toEqual(run.mock.calls[0]?.[0].body)
  })
})
