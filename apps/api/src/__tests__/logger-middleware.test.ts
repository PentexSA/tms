/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import {
  accessLevel,
  errorKind,
  numericStatus,
  parseClientVersion,
} from '../middlewares/loggerMiddleware'

describe('errorKind', () => {
  it('usa o código do erro quando existe', () => {
    expect(errorKind({ code: 'NOT_FOUND', message: 'segredo' })).toBe(
      'NOT_FOUND'
    )
    expect(errorKind({ code: 23505 })).toBe('23505')
  })

  it('usa o nome da classe, nunca a mensagem', () => {
    expect(errorKind(new TypeError('valor do usuário'))).toBe('TypeError')
    expect(errorKind(Object.create(null))).toBe('Error')
  })

  it('valores que não são objeto viram o tipo', () => {
    expect(errorKind('texto do usuário')).toBe('string')
    expect(errorKind(undefined)).toBe('undefined')
  })

  it('código com texto livre não sai', () => {
    expect(errorKind({ code: 'texto livre do usuário' })).toBe('Object')
  })

  it('getter que lança não derruba o log de acesso', () => {
    const hostile = {
      get code() {
        throw new Error('segredo')
      },
    }
    expect(errorKind(hostile)).toBe('Object')
  })
})

describe('parseClientVersion', () => {
  it.each(['1.2.3', '0.0.0', '9999.9999.9999'])('aceita %s', value => {
    expect(parseClientVersion(value)).toBe(value)
  })

  // O Headers recusa quebra de linha, então esses só chegam aqui direto. Um
  // cliente HTTP cru não passa do parser do Bun com eles
  it.each([
    [null],
    [''],
    ['1.2'],
    ['1.2.3.4'],
    ['12345.0.0'],
    ['v1.2.3'],
    ['1.2.3-beta'],
    ['1.2.3\n{"level":60}'],
    ['1.2.3\r\n{"level":60}'],
    ['\n1.2.3'],
    [' 1.2.3 '],
  ])('%p vira unknown', value => {
    expect(parseClientVersion(value)).toBe('unknown')
  })
})

describe('numericStatus e accessLevel', () => {
  it('status por número ou por nome', () => {
    expect(numericStatus(200)).toBe(200)
    expect(numericStatus('Not Found')).toBe(404)
    expect(numericStatus("I'm a teapot")).toBe(418)
  })

  it('outro valor não quebra', () => {
    for (const value of [undefined, null, 'toString', 'qualquer', {}])
      expect(numericStatus(value)).toBeNull()
  })

  it('nível pelo status', () => {
    expect(accessLevel(500)).toBe('error')
    expect(accessLevel(599)).toBe('error')
    expect(accessLevel(429)).toBe('warn')
    expect(accessLevel(404)).toBe('info')
    expect(accessLevel(200)).toBe('info')
    expect(accessLevel(null)).toBe('info')
  })
})
