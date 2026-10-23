/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { CHANGE_CLASSES, type ChangeClass, strictest } from '../classify'
import {
  CHARACTER_STATUSES,
  isCharacterStatus,
  rollPolicy,
  type WriteAccess,
  writePolicy,
} from '../policy'

const OWNER: WriteAccess = { owner: true, storyteller: false, member: true }
const FORMER: WriteAccess = { owner: true, storyteller: false, member: false }
const STORYTELLER: WriteAccess = {
  owner: false,
  storyteller: true,
  member: false,
}
// O narrador que também é dono da ficha
const BOTH: WriteAccess = { owner: true, storyteller: true, member: true }
const STRANGER: WriteAccess = { owner: false, storyteller: false, member: true }

const each: ChangeClass[][] = [[], ...CHANGE_CLASSES.map(c => [c])]
const code = (r: ReturnType<typeof writePolicy>) => (r.ok ? 'ok' : r.code)

// doc/painel-narrador.md §5.1, "A política": uma linha por estado.
describe('writePolicy: a tabela do 5.1', () => {
  it('creating: o dono grava play, advance e edit', () => {
    for (const classes of each)
      expect(code(writePolicy(OWNER, 'creating', false, classes))).toBe('ok')
  })

  it('active: o dono grava play e edit; advance pede o narrador', () => {
    expect(code(writePolicy(OWNER, 'active', false, ['play']))).toBe('ok')
    expect(code(writePolicy(OWNER, 'active', false, ['edit']))).toBe('ok')
    expect(code(writePolicy(OWNER, 'active', false, ['advance']))).toBe(
      'NEEDS_XP_APPROVAL'
    )
    // O lote é atômico: uma parte advance recusa o lote inteiro
    expect(
      code(writePolicy(OWNER, 'active', false, ['play', 'advance', 'edit']))
    ).toBe('NEEDS_XP_APPROVAL')
  })

  it('active travada: o dono não grava nada, nem jogo', () => {
    for (const classes of each)
      expect(code(writePolicy(OWNER, 'active', true, classes))).toBe(
        'SHEET_LOCKED'
      )
  })

  it('archived e dead: o dono não grava nada', () => {
    for (const status of ['archived', 'dead'])
      for (const classes of each)
        for (const locked of [false, true])
          expect(code(writePolicy(OWNER, status, locked, classes))).toBe(
            'SHEET_NOT_EDITABLE'
          )
  })

  it('a trava só vale em active', () => {
    expect(code(writePolicy(OWNER, 'creating', true, ['advance']))).toBe('ok')
  })

  it('ex-membro (dono sem vínculo): nada, em qualquer estado', () => {
    for (const status of CHARACTER_STATUSES)
      for (const classes of each)
        for (const locked of [false, true])
          expect(code(writePolicy(FORMER, status, locked, classes))).toBe(
            'NOT_MEMBER'
          )
  })

  it('o narrador grava tudo, em todo estado, travada ou não', () => {
    for (const who of [STORYTELLER, BOTH])
      for (const status of CHARACTER_STATUSES)
        for (const classes of each)
          for (const locked of [false, true])
            expect(code(writePolicy(who, status, locked, classes))).toBe('ok')
  })

  it('fail secure: sem papel na ficha, ou estado desconhecido, não grava', () => {
    expect(code(writePolicy(STRANGER, 'creating', false, ['play']))).toBe(
      'FORBIDDEN'
    )
    // `pending` chega na v4: até lá, o dono não grava nele
    for (const status of ['pending', '', 'ACTIVE'])
      expect(code(writePolicy(OWNER, status, false, ['play']))).toBe(
        'SHEET_NOT_EDITABLE'
      )
  })
})

describe('rollPolicy', () => {
  it('travada: o dono rola sem custo, e não rola gastando', () => {
    expect(code(rollPolicy(OWNER, 'active', true, null))).toBe('ok')
    expect(code(rollPolicy(OWNER, 'active', true, ['play']))).toBe(
      'SHEET_LOCKED'
    )
    expect(code(rollPolicy(OWNER, 'active', false, ['play']))).toBe('ok')
  })

  it('sem custo, o estado e o vínculo continuam valendo', () => {
    expect(code(rollPolicy(OWNER, 'creating', false, null))).toBe('ok')
    expect(code(rollPolicy(OWNER, 'archived', false, null))).toBe(
      'SHEET_NOT_EDITABLE'
    )
    expect(code(rollPolicy(FORMER, 'active', false, null))).toBe('NOT_MEMBER')
    expect(code(rollPolicy(FORMER, 'active', false, ['play']))).toBe(
      'NOT_MEMBER'
    )
    expect(code(rollPolicy(STORYTELLER, 'dead', true, ['play']))).toBe('ok')
  })
})

describe('apoio', () => {
  it('strictest: advance > edit > play; vazio é null', () => {
    expect(strictest([])).toBeNull()
    expect(strictest(['play', 'edit'])).toBe('edit')
    expect(strictest(['edit', 'advance', 'play'])).toBe('advance')
  })

  it('isCharacterStatus aceita só os estados da v3', () => {
    for (const s of CHARACTER_STATUSES) expect(isCharacterStatus(s)).toBe(true)
    for (const s of ['pending', 'ativo', null, 1])
      expect(isCharacterStatus(s)).toBe(false)
  })
})
