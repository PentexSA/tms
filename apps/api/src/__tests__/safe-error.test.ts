/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { newInviteCode } from '../chronicles/invite-code'
import { redact, safeError } from '../http/safe-error'

const EMAIL = 'pessoa.canario@empresa.com.br'
const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcmlvIn0.c2VncmVkby1kby1jYW5hcmlv'
const BEARER = 'Bearer tokencanario123'
const DB_URL = 'postgres://usuario:senha-canario@db.example.test:5432/tms'
const NOTE = 'o vampiro esconde a carta da Camarilla'

const text = (value: unknown) => JSON.stringify(safeError(value))

describe('safeError: erro do Postgres', () => {
  const pgError = () =>
    Object.assign(
      new Error(`duplicate key value: Key (email)=(${EMAIL}) already exists`),
      {
        code: '23505',
        detail: `Key (email)=(${EMAIL}) already exists.`,
        where: 'função canario',
        table: 'users',
        constraint: 'users_email_key',
      }
    )

  it('só nome, SQLSTATE e frames', () => {
    const safe = safeError(pgError())
    expect(safe.name).toBe('Error')
    expect(safe.code).toBe('23505')
    expect(Object.keys(safe).sort()).toEqual(['code', 'name', 'stack'])
  })

  it('nada da mensagem nem dos demais campos, nem no stack', () => {
    const logged = text(pgError())
    for (const leak of [EMAIL, 'Key (email)', 'canario', 'users_email_key'])
      expect(logged).not.toContain(leak)
  })
})

describe('safeError: stack', () => {
  it('só as linhas de frame: a primeira repete a mensagem', () => {
    const error = new TypeError(`Key (email)=(${EMAIL})`)
    const { stack } = safeError(error)
    expect(stack).toBeString()
    expect(stack).not.toContain('Key (email)')
    for (const line of (stack as string).split('\n'))
      expect(line).toStartWith('at ')
  })

  it('linha da mensagem que se passa por frame fica de fora', () => {
    const error = new Error(`falhou\n    at ${NOTE}`)
    expect(safeError(error).stack).not.toContain('vampiro')
  })

  it('sem stack, sem o campo', () => {
    const error = new Error('x')
    error.stack = undefined
    expect(safeError(error)).toEqual({ name: 'Error', message: 'x' })
  })

  it('stack que não é texto é ignorado', () => {
    const error = Object.assign(new Error('x'), { stack: { a: NOTE } })
    expect(text(error)).not.toContain(NOTE)
  })
})

describe('safeError: SyntaxError', () => {
  it('sem mensagem: o JSON.parse repete a entrada', () => {
    let error: unknown
    try {
      JSON.parse(NOTE)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(SyntaxError)
    expect(text(error)).not.toContain('vampiro')
    expect(safeError(error).name).toBe('SyntaxError')
    expect(safeError(error).message).toBeUndefined()
  })

  it('reconhece pelo nome, sem depender da classe', () => {
    const error = Object.assign(new Error(NOTE), { name: 'SyntaxError' })
    expect(safeError(error).message).toBeUndefined()
  })
})

describe('safeError: demais erros', () => {
  it.each([
    ['e-mail', `falhou para ${EMAIL}`, EMAIL],
    ['e-mail entre parênteses', `(${EMAIL})`, EMAIL],
    ['JWT', `token ${JWT} inválido`, JWT],
    ['Bearer', `header ${BEARER} recusado`, 'tokencanario123'],
    ['credencial em URL', `sem conexão com ${DB_URL}`, 'senha-canario'],
    ['usuário em URL', `sem conexão com ${DB_URL}`, 'usuario:'],
    ['senha com arroba', 'postgres://u:se@nha@host/db', 'se@nha'],
  ])('redige %s', (_name, message, secret) => {
    const safe = safeError(new Error(message))
    expect(safe.message).toBeString()
    expect(JSON.stringify(safe)).not.toContain(secret)
  })

  it('mantém o que ajuda a investigar', () => {
    expect(safeError(new Error(`sem conexão com ${DB_URL}`)).message).toBe(
      'sem conexão com postgres://[credencial]@db.example.test:5432/tms'
    )
    const message = 'pacote@1.2.3 quebrou: Cannot read properties of undefined'
    expect(safeError(new Error(message)).message).toBe(message)
  })

  it('limita a mensagem a 300 caracteres, depois da redação', () => {
    const safe = safeError(new Error(`${'x'.repeat(299)} ${EMAIL}`))
    expect(safe.message).toHaveLength(300)
    expect(JSON.stringify(safe)).not.toContain('pessoa')
  })

  it('mensagem enorme nem é lida', () => {
    const safe = safeError(new Error(`${EMAIL} `.repeat(5000)))
    expect(safe.message).toBe('[mensagem longa omitida]')
  })

  it('usa a classe quando o name foi herdado', () => {
    class ConexaoError extends Error {}
    expect(safeError(new ConexaoError('x')).name).toBe('ConexaoError')
    expect(safeError(new TypeError('x')).name).toBe('TypeError')
    const pg = Object.assign(new Error('x'), { name: 'error' })
    expect(safeError(pg).name).toBe('error')
  })

  it('name com texto livre não sai', () => {
    const error = Object.assign(new Error('x'), { name: `Falha ${NOTE}` })
    expect(safeError(error).name).toBe('Error')
  })

  it('objeto que não é Error passa pelo mesmo filtro', () => {
    const safe = safeError({ code: '23505', message: `Key (email)=(${EMAIL})` })
    expect(safe).toEqual({ name: 'Object', code: '23505' })
    expect(text({ detail: NOTE })).not.toContain(NOTE)
  })
})

describe('safeError: code', () => {
  it.each([
    ['ERR_JWT_EXPIRED', 'ERR_JWT_EXPIRED'],
    ['ECONNREFUSED', 'ECONNREFUSED'],
    [404, '404'],
  ])('aceita %p', (code, expected) => {
    expect(safeError(Object.assign(new Error('x'), { code })).code).toBe(
      expected
    )
  })

  it.each([
    [`texto ${NOTE}`],
    ['segredo'],
    ['A'.repeat(41)],
    [Number.NaN],
    [{}],
    [true],
  ])('recusa %p', code => {
    expect(
      safeError(Object.assign(new Error('x'), { code })).code
    ).toBeUndefined()
  })
})

describe('safeError: cause', () => {
  it('passa pelo mesmo filtro', () => {
    const error = new Error('fora', {
      cause: Object.assign(new Error(`Key (email)=(${EMAIL})`), {
        code: '23505',
      }),
    })
    const safe = safeError(error)
    expect(safe.cause?.code).toBe('23505')
    expect(safe.cause?.message).toBeUndefined()
    expect(JSON.stringify(safe)).not.toContain(EMAIL)
  })

  it('para na profundidade 3', () => {
    let error = new Error('nível 5')
    for (const level of [4, 3, 2, 1, 0])
      error = new Error(`nível ${level}`, { cause: error })
    const safe = safeError(error)
    expect(safe.cause?.cause?.cause?.message).toBe('nível 3')
    expect(safe.cause?.cause?.cause?.cause).toBeUndefined()
  })

  it('causa circular não trava', () => {
    const error = new Error('círculo') as Error & { cause?: unknown }
    error.cause = error
    expect(safeError(error).cause?.cause?.cause?.cause).toBeUndefined()
  })

  it('causa que não é Error não vaza texto', () => {
    const safe = safeError(new Error('x', { cause: NOTE }))
    expect(safe.cause).toEqual({ name: 'string' })
  })
})

describe('safeError: nunca lança', () => {
  it.each([
    ['string', `texto ${NOTE}`, 'string'],
    ['número', 42, 'number'],
    ['undefined', undefined, 'undefined'],
    ['null', null, 'null'],
    ['symbol', Symbol('s'), 'symbol'],
    ['bigint', 1n, 'bigint'],
    ['função', () => NOTE, 'function'],
    ['booleano', false, 'boolean'],
  ])('valor que não é Error: %s', (_name, value, name) => {
    expect(safeError(value)).toEqual({ name })
  })

  it('objeto sem protótipo', () => {
    expect(safeError(Object.create(null))).toEqual({ name: 'Error' })
  })

  it.each(['message', 'stack', 'code', 'name', 'cause', 'constructor'])(
    'getter de %s que lança',
    key => {
      const error = new Error('mensagem')
      Object.defineProperty(error, key, {
        get() {
          throw new Error(NOTE)
        },
      })
      expect(() => safeError(error)).not.toThrow()
      expect(text(error)).not.toContain(NOTE)
    }
  )

  it('getter que devolve tipo errado', () => {
    const error = new Error('x')
    Object.defineProperty(error, 'message', { get: () => ({ a: NOTE }) })
    expect(text(error)).not.toContain(NOTE)
  })

  it('Proxy em que tudo lança', () => {
    const fail = () => {
      throw new Error(NOTE)
    }
    const hostile = new Proxy(
      {},
      { get: fail, has: fail, getPrototypeOf: fail, ownKeys: fail }
    )
    expect(safeError(hostile)).toEqual({ name: 'Error' })
  })

  it('Proxy revogado', () => {
    const { proxy, revoke } = Proxy.revocable({}, {})
    revoke()
    expect(safeError(proxy)).toEqual({ name: 'Error' })
  })
})

describe('redact: código de convite (P12)', () => {
  // Código fictício, gerado aqui: nenhum convite real em teste
  const code = newInviteCode()
  const formatted = code.replace(/(.{4})(?=.)/g, '$1 ')

  it('cru, formatado, com hífens e em minúsculas', () => {
    for (const text of [
      `aceite ${code} falhou`,
      `aceite ${formatted} falhou`,
      `aceite ${formatted.replace(/ /g, '-')} falhou`,
      `"${code.toLowerCase()}"`,
    ]) {
      const out = redact(text)
      expect(out).toContain('[convite]')
      expect(out).not.toContain(code)
      expect(out).not.toContain(code.slice(0, 8))
    }
  })

  it('o fragmento de URL e de caminho', () => {
    expect(redact('GET https://app.test/join#qualquer-coisa ok')).toBe(
      'GET https://app.test/join#[convite] ok'
    )
    expect(redact(`abriu /join#${code}`)).toBe('abriu /join#[convite]')
  })

  it('não apaga UUID, hash, método privado nem texto comum', () => {
    const uuid = '123e4567-e89b-42d3-a456-426614174000'
    const hash = 'a'.repeat(64)
    for (const text of [
      uuid,
      hash,
      'at Foo.#bar (file:///x.js:1:2)',
      'Cannot read properties of undefined (reading x)',
      // 26 letras, mas com U, que o alfabeto não tem
      'at ChronicleInviteSheetUnused (x.js:1:2)',
    ])
      expect(redact(text)).toBe(text)
  })

  it('a mensagem do erro sai sem o código', () => {
    const safe = safeError(new Error(`convite ${formatted} recusado`))
    expect(safe.message).toBe('convite [convite] recusado')
  })
})
