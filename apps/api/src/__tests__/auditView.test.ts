/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { auditDetail, auditShowsUser } from '../chronicles/auditView'

// T-63: o detalhe da auditoria é uma lista branca por ação. O payload cru
// nunca sai, e valor fora do esperado sai como ausente.

describe('auditDetail', () => {
  it('estado e visibilidade: só os códigos conhecidos', () => {
    expect(
      auditDetail('character.status', { from: 'active', to: 'archived' })
    ).toEqual({ from: 'active', to: 'archived' })
    expect(
      auditDetail('character.status', { from: '<script>', to: 'dead', x: 1 })
    ).toEqual({ to: 'dead' })
    expect(
      auditDetail('character.visibility', { from: 'hidden', to: 'full' })
    ).toEqual({ from: 'hidden', to: 'full' })
    expect(
      auditDetail('character.visibility', { from: 'secreto', to: 3 })
    ).toEqual({})
  })

  it('conclusão e regras da criação: só booleanos', () => {
    expect(
      auditDetail('character.creation.complete', {
        mode: 'points',
        approved: true,
      })
    ).toEqual({ approved: true })
    expect(
      auditDetail('chronicle.creation.settings', {
        approval: true,
        approvalFrom: false,
        defaults: true,
      })
    ).toEqual({ approval: true, approvalFrom: false, defaults: true })
    // Registro antigo, sem o "de": a frase sai sem ele
    expect(
      auditDetail('chronicle.creation.settings', {
        approval: 'sim',
        defaults: false,
      })
    ).toEqual({ defaults: false })
  })

  it('XP: números gravados como texto voltam a ser números; ids viram contagem', () => {
    expect(
      auditDetail('xp.grant', {
        operationId: 'op',
        amount: '3',
        characters: ['a', 'b'],
      })
    ).toEqual({ amount: 3, characters: 2 })
    expect(auditDetail('xp.adjust', { delta: '-2', operationId: 'x' })).toEqual(
      { delta: -2 }
    )
    expect(auditDetail('xp.request.approve', { cost: 7 })).toEqual({ cost: 7 })
    expect(auditDetail('xp.grant', { amount: '3.5', characters: 'a' })).toEqual(
      {}
    )
    expect(auditDetail('xp.adjust', { delta: '99999999999' })).toEqual({})
    expect(auditDetail('xp.request.approve', { cost: Number.NaN })).toEqual({})
  })

  it('membro e convite: contagem e números, nunca o código', () => {
    expect(
      auditDetail('member.remove', { characters: ['a'], invitesRevoked: true })
    ).toEqual({ characters: 1 })
    expect(auditDetail('member.leave', { characters: [] })).toEqual({
      characters: 0,
    })
    expect(
      auditDetail('invite.create', {
        inviteId: 'i',
        maxUses: 10,
        expiresInDays: 7,
        code: 'NUNCA',
      })
    ).toEqual({ maxUses: 10, expiresInDays: 7 })
  })

  it('as outras ações e payloads estranhos: vazio', () => {
    expect(auditDetail('chronicle.create', {})).toEqual({})
    expect(
      auditDetail('chronicle.session.update', { sessionId: 's', revision: 2 })
    ).toEqual({})
    expect(auditDetail('ação-desconhecida', { a: 1 })).toEqual({})
    expect(auditDetail('character.status', null)).toEqual({})
    expect(auditDetail('xp.grant', ['3'])).toEqual({})
    expect(auditDetail('xp.grant', 'texto')).toEqual({})
  })
})

describe('auditShowsUser', () => {
  it('só membro e transferência levam o usuário alvo', () => {
    for (const action of [
      'member.remove',
      'member.leave',
      'chronicle.transfer.request',
      'chronicle.transfer.accept',
      'chronicle.transfer.reject',
      'chronicle.transfer.cancel',
    ])
      expect(auditShowsUser(action)).toBe(true)
    for (const action of ['character.status', 'xp.adjust', 'invite.create'])
      expect(auditShowsUser(action)).toBe(false)
  })
})
