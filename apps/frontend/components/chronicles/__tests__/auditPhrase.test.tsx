import {
  auditPhrase,
  type HistoryAction,
  PHRASES,
  type PhraseItem,
} from '../auditPhrase'

// T-63: uma frase para cada código da auditoria, sem o código na tela.
// (.tsx: o testMatch do Jest em components/ só pega .test.tsx)

const item = (
  action: string,
  over: Partial<Omit<PhraseItem, 'action'>> = {}
): PhraseItem =>
  ({
    action,
    byRole: null,
    character: { id: 'c1', name: 'Helena', deleted: false },
    user: { username: 'beto' },
    detail: {},
    ...over,
  }) as PhraseItem

const CODE = /^[a-z]+([.-][a-z-]+)+$/

describe('auditPhrase', () => {
  it('cada código tem frase, e nenhuma frase é o código', () => {
    const actions = Object.keys(PHRASES) as HistoryAction[]
    expect(actions.length).toBeGreaterThanOrEqual(39)
    for (const action of actions) {
      const phrase = auditPhrase(item(action))
      expect(phrase).not.toMatch(CODE)
      expect(phrase).not.toContain(action)
      expect(phrase.length).toBeGreaterThan(0)
    }
  })

  it('código desconhecido vira "Ação registrada"', () => {
    expect(auditPhrase(item('chronicle.update'))).toBe('Ação registrada')
    expect(auditPhrase(item('toString'))).toBe('Ação registrada')
  })

  it.each([
    ['chronicle.create', {}, 'Crônica criada'],
    [
      'invite.create',
      { detail: { maxUses: 10, expiresInDays: 7 } },
      'Convite gerado: até 10 usos, vale 7 dias',
    ],
    [
      'invite.create',
      { detail: { maxUses: 1, expiresInDays: 1 } },
      'Convite gerado: até 1 uso, vale 1 dia',
    ],
    ['invite.create', {}, 'Convite gerado'],
    [
      'chronicle.creation.settings',
      { detail: { approval: true, approvalFrom: false, defaults: false } },
      'Regras da criação: aprovação Desligada → Ligada',
    ],
    [
      'chronicle.creation.settings',
      { detail: { approval: false, defaults: true } },
      'Regras da criação: aprovação Desligada; orçamento padrão alterado',
    ],
    [
      'chronicle.creation.settings',
      { detail: { defaults: true } },
      'Regras da criação: orçamento padrão alterado',
    ],
    ['chronicle.creation.settings', {}, 'Regras da criação alteradas'],
    ['character.create-npc', {}, 'NPC Helena criado, oculto'],
    [
      'character.visibility',
      { detail: { from: 'hidden', to: 'identity' } },
      'Helena: Oculto → Identidade revelada',
    ],
    ['character.visibility', {}, 'Visibilidade de Helena alterada'],
    [
      'character.status',
      { detail: { from: 'active', to: 'archived' } },
      'Helena: Em jogo → Arquivada',
    ],
    [
      'character.status',
      { detail: { from: 'active', to: 'dead' } },
      'Helena: Em jogo → Fora de jogo',
    ],
    ['character.status', {}, 'Estado de Helena alterado'],
    ['character.lock', {}, 'Helena travada'],
    ['character.creation.return', {}, 'Helena devolvida para correção'],
    ['character.creation.complete', {}, 'Criação de Helena concluída'],
    [
      'character.creation.adjust',
      { detail: { reason: 'MOTIVO-DO-AJUSTE' } },
      'Ajuste pedido em Helena',
    ],
    ['character.creation.ready', {}, 'O dono de Helena avisou que terminou'],
    [
      'member.remove',
      { detail: { characters: 2 } },
      'beto removido da crônica (2 fichas arquivadas)',
    ],
    [
      'member.remove',
      { detail: { characters: 1 } },
      'beto removido da crônica (1 ficha arquivada)',
    ],
    [
      'member.remove',
      { detail: { characters: 0 } },
      'beto removido da crônica',
    ],
    ['member.leave', { user: null }, 'Conta excluída saiu da crônica'],
    [
      'xp.grant',
      { detail: { amount: 3, characters: 2 } },
      '3 XP concedidos a 2 fichas',
    ],
    ['xp.grant', {}, 'XP concedido'],
    ['xp.adjust', { detail: { delta: 2 } }, 'Ajuste de XP em Helena: +2'],
    ['xp.adjust', { detail: { delta: -1 } }, 'Ajuste de XP em Helena: -1'],
    ['xp.adjust', {}, 'Ajuste de XP em Helena'],
    [
      'xp.request.approve',
      { detail: { cost: 7 } },
      'Pedido de XP de Helena aprovado (custo 7)',
    ],
    ['xp.request.approve', {}, 'Pedido de XP de Helena aprovado'],
    ['chronicle.transfer.request', {}, 'Narração proposta a beto'],
    ['sheet.change', { byRole: 'owner' }, 'Helena alterada pelo dono'],
    [
      'sheet.change',
      { byRole: 'storyteller' },
      'Helena alterada pelo narrador',
    ],
    ['sheet.change', {}, 'Helena alterada'],
    ['damage', {}, 'Dano em grupo: Helena'],
    ['xp-grant', {}, 'XP lançado na ficha de Helena'],
    [
      'xp-grant',
      { character: { id: 'c1', name: 'Helena', deleted: true } },
      'XP lançado na ficha de Helena (excluída)',
    ],
    [
      'character.delete',
      { character: { id: 'c1', name: 'Helena', deleted: true } },
      'Helena excluída',
    ],
    ['character.lock', { character: null }, 'uma ficha travada'],
  ] as const)('%s %j → %s', (action, over, expected) => {
    expect(
      auditPhrase(item(action, over as Partial<Omit<PhraseItem, 'action'>>))
    ).toBe(expected)
  })
})
