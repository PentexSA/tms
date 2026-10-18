/// <reference types="bun-types" />
import { describe, expect, it, spyOn } from 'bun:test'
import type { LogEvent } from 'kysely'
import { errorCode, kyselyLogger, logger } from '../logger'

const query = {
  sql: 'insert into "users" ("email", "hashed_password") values ($1, $2)',
  parameters: ['pessoa@example.test', '$argon2id$segredo'],
  query: { kind: 'InsertQueryNode' },
} as unknown as LogEvent['query']

describe('kyselyLogger', () => {
  it('nunca loga parâmetros da query', () => {
    const debug = spyOn(logger, 'debug')
    try {
      kyselyLogger({ level: 'query', query, queryDurationMillis: 1.6 })
      const logged = JSON.stringify(debug.mock.calls)
      expect(logged).toContain('insert into')
      expect(logged).not.toContain('pessoa@example.test')
      expect(logged).not.toContain('segredo')
    } finally {
      debug.mockRestore()
    }
  })

  it('erro: só o código SQLSTATE, nunca a mensagem do Postgres', () => {
    const error = spyOn(logger, 'error')
    try {
      kyselyLogger({
        level: 'error',
        query,
        queryDurationMillis: 2,
        error: Object.assign(
          new Error(
            'duplicate key value violates unique constraint: Key (email)=(pessoa@example.test)'
          ),
          { code: '23505' }
        ),
      })
      const logged = JSON.stringify(error.mock.calls)
      expect(logged).toContain('23505')
      expect(logged).not.toContain('pessoa@example.test')
    } finally {
      error.mockRestore()
    }
  })

  it('errorCode', () => {
    expect(errorCode({ code: '42P01' })).toBe('42P01')
    expect(errorCode(new TypeError('x'))).toBe('TypeError')
    expect(errorCode('texto')).toBe('string')
  })
})
