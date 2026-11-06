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
import { modelOf, sheetFor } from '../../../test/fixtures'
import { canEditIn } from '../../evolve/hooks'
import {
  costLabel,
  filterCandidates,
  groupCandidates,
  optionLabel,
  optionMeta,
  refusalMayBeStale,
  requestRefusal,
  xpCandidates,
} from '../candidates'
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

// T-77: o que o servidor recusaria, na ordem em que ele confere
describe('requestRefusal e optionMeta', () => {
  const [strength] = xpCandidates(model, sheet)
  if (!strength?.cost.ok) throw new Error('fixture sem custo')
  const ctx = { available: 10, pendingKeys: new Set<string>(), online: true }
  const maxed = {
    ...strength,
    cost: { ok: false as const, code: 'XP_MAX_REACHED' as const },
  } as unknown as typeof strength

  it('sem escolha, sem custo, sem saldo, pedido pendente, sem rede; tudo certo é null', () => {
    expect(requestRefusal(null, ctx)).toBe('Escolha um traço para ver o custo.')
    expect(requestRefusal(maxed, ctx)).toBe(
      'No máximo: este traço não pode ser pedido agora.'
    )
    expect(requestRefusal(strength, { ...ctx, available: 4 })).toBe(
      'Faltam 4 XP (custa 8, disponível 4).'
    )
    const pending = { ...ctx, pendingKeys: new Set([strength.key]) }
    expect(requestRefusal(strength, pending)).toBe(
      'Já há um pedido pendente para este traço.'
    )
    // A ordem do servidor: o saldo antes do pendente
    expect(requestRefusal(strength, { ...pending, available: 0 })).toContain(
      'Faltam 8 XP'
    )
    expect(requestRefusal(strength, { ...ctx, online: false })).toBe(
      'Conecte-se para enviar. Nada foi enviado.'
    )
    expect(requestRefusal(strength, ctx)).toBeNull()
  })

  it('só a recusa de saldo ou de pedido pendente pode estar velha (refaz as consultas)', () => {
    expect(refusalMayBeStale(strength, { ...ctx, available: 4 })).toBe(true)
    expect(
      refusalMayBeStale(strength, {
        ...ctx,
        pendingKeys: new Set([strength.key]),
      })
    ).toBe(true)
    expect(refusalMayBeStale(maxed, ctx)).toBe(false)
    expect(refusalMayBeStale(null, ctx)).toBe(false)
    expect(refusalMayBeStale(strength, ctx)).toBe(false)
  })

  it('a opção diz o motivo curto e fica bloqueada', () => {
    expect(optionMeta(strength, ctx)).toEqual({
      meta: '2 → 3 · 8 XP',
      blocked: false,
    })
    expect(optionMeta(strength, { ...ctx, available: 4 })).toEqual({
      meta: '2 → 3 · 8 XP · faltam 4',
      blocked: true,
    })
    expect(
      optionMeta(strength, { ...ctx, pendingKeys: new Set([strength.key]) })
    ).toEqual({ meta: '2 → 3 · 8 XP · pedido pendente', blocked: true })
    expect(optionMeta(maxed, ctx)).toEqual({
      meta: 'No máximo',
      blocked: true,
    })
  })
})

// T-50: a lista de evolução agrupada como a ficha, nos três sistemas
describe('groupCandidates: os blocos do template', () => {
  const grouped = (id: string) => {
    const { model: m, sheet: s } = sheetFor(id, ['owner'])
    const sections = groupCandidates(m, xpCandidates(m, s))
    return { m, s, sections }
  }
  const outline = (sections: ReturnType<typeof groupCandidates>) =>
    sections.map(s => [s.title, s.blocks.map(b => b.title)])

  it('V20: as seções na ordem da ficha, com os grupos; a "Consciência" do Talento e a da Virtude em blocos diferentes', () => {
    const { m, sections } = grouped('helena')
    expect(outline(sections)).toEqual([
      ['Em jogo', ['Em jogo']],
      ['Atributos', ['Físicos', 'Sociais', 'Mentais']],
      ['Habilidades', ['Talentos', 'Perícias', 'Conhecimentos']],
      ['Vantagens', ['Disciplinas', 'Virtudes', 'Trilha']],
    ])
    const blocks = sections.flatMap(s => s.blocks)
    const holding = (field: string) =>
      blocks
        .filter(b => b.candidates.some(c => c.target.field === field))
        .map(b => b.title)
    // Os dois traços têm o mesmo nome: o bloco é o que os separa (POW-17)
    expect(m.fields.get('awareness')?.def.label).toBe(
      m.fields.get('conscience')?.def.label
    )
    expect(holding('awareness')).toEqual(['Talentos'])
    expect(holding('conscience')).toEqual(['Virtudes'])
    // A ordem do template dentro do bloco
    const physical = blocks.find(b => b.title === 'Físicos')
    expect(physical?.candidates.map(c => c.target.field)).toEqual([
      'strength',
      'dexterity',
      'stamina',
    ])
  })

  it('V20: a lista é um bloco com os itens da ficha primeiro e o "(novo)" depois, sem o nome da lista na opção', () => {
    const { m, sections } = grouped('helena')
    const disciplines = sections
      .flatMap(s => s.blocks)
      .find(b => b.title === 'Disciplinas')
    const items = disciplines?.candidates ?? []
    expect(items.length).toBeGreaterThan(1)
    const firstNew = items.findIndex(c => !c.target.item)
    expect(items.slice(0, firstNew).every(c => c.target.item)).toBe(true)
    expect(items.slice(firstNew).every(c => c.target.name)).toBe(true)
    const novel = items[firstNew] as (typeof items)[number]
    expect(novel.label.startsWith('Disciplinas: ')).toBe(true)
    expect(optionLabel(m, novel)).toBe(
      novel.label.slice('Disciplinas: '.length)
    )
  })

  it('W20: "Em jogo" com a Fúria, a Gnose e a FdV; M20: "Esferas" e "Antecedentes"', () => {
    expect(outline(grouped('iara').sections)).toEqual([
      ['Em jogo', ['Em jogo']],
      ['Atributos', ['Físicos', 'Sociais', 'Mentais']],
      ['Habilidades', ['Talentos', 'Perícias', 'Conhecimentos']],
    ])
    const play = grouped('iara').sections[0]?.blocks[0]
    expect(play?.candidates.map(c => c.target.field)).toEqual([
      'rage',
      'gnosis',
      'willpower',
    ])
    const mage = outline(grouped('tomas').sections)
    expect(mage).toContainEqual(['Esferas', ['Arete', 'Esferas']])
    expect(mage).toContainEqual(['Antecedentes', ['Antecedentes']])
  })

  it('a busca sem acento acha pelo traço e pelo bloco; bloco vazio some', () => {
    const { m, sections } = grouped('helena')
    const brawl = m.fields.get('brawl')?.def.label as string
    const found = filterCandidates(m, sections, brawl.slice(0, 4).toUpperCase())
    expect(
      found
        .flatMap(s => s.blocks)
        .flatMap(b => b.candidates)
        .map(c => c.target.field)
    ).toContain('brawl')
    // O título do bloco traz o bloco inteiro
    const block = filterCandidates(m, sections, 'disciplinas')
    expect(block.flatMap(s => s.blocks.map(b => b.title))).toEqual([
      'Disciplinas',
    ])
    expect(filterCandidates(m, sections, 'zzzz')).toEqual([])
    expect(filterCandidates(m, sections, '  ')).toEqual(sections)
  })
})
