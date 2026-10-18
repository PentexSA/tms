/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { errorKind } from '../middlewares/loggerMiddleware'

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
})
