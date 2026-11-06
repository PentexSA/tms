import {
  createEventLimiter,
  type EventLike,
  redact,
  scrubBreadcrumb,
  scrubUrl,
  scrubWebEvent,
  toCapture,
} from '../telemetryFilter'

const EMAIL = 'pessoa.canario@example.test'
const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjYW5hcmlvIn0.c2VncmVkby1kby1jYW5hcmlv'
const NOTE = 'o vampiro esconde a carta da Camarilla'
const UUID = '123e4567-e89b-42d3-a456-426614174000'

// Um código fictício no alfabeto do convite (base32 Crockford, 26 caracteres)
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const fakeInviteCode = () =>
  Array.from(
    { length: 26 },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  ).join('')

describe('redact', () => {
  it('e-mail, JWT, Bearer e credencial de URL', () => {
    const out = redact(
      `a ${EMAIL} b ${JWT} c Bearer tokencanario123 d postgres://u:senha@db/x`
    )
    for (const leak of [EMAIL, JWT, 'tokencanario123', 'senha'])
      expect(out).not.toContain(leak)
  })

  it('pacote@1.2.3 não é e-mail', () => {
    expect(redact('node_modules/pacote@1.2.3/x.js')).toContain('pacote@1.2.3')
  })

  it('o código de convite, cru e formatado, e o fragmento de URL (P12)', () => {
    const code = fakeInviteCode()
    const formatted = code.replace(/(.{4})(?=.)/g, '$1 ')
    for (const text of [
      `x ${code} y`,
      `x ${formatted} y`,
      `x ${code.toLowerCase()} y`,
    ]) {
      const out = redact(text)
      expect(out).toBe('x [convite] y')
    }
    expect(redact(`https://app.test/join#${code}`)).toBe(
      'https://app.test/join#[convite]'
    )
    expect(redact(`em /join#${formatted.replace(/ /g, '-')}`)).toBe(
      'em /join#[convite]'
    )
  })

  it('não apaga UUID, hash nem método privado do stack', () => {
    for (const text of [
      UUID,
      'f'.repeat(64),
      'at Foo.#bar (https://app.test/x.js:1:2)',
    ])
      expect(redact(text)).toBe(text)
  })
})

describe('scrubUrl', () => {
  it('sem query nem hash, UUID vira :id', () => {
    expect(
      scrubUrl(`https://app.test/characters/${UUID}?convite=abc#segredo`)
    ).toBe('https://app.test/characters/:id')
    expect(scrubUrl(`/chronicles/${UUID}/members?x=1`)).toBe(
      '/chronicles/:id/members'
    )
  })

  it.each([undefined, null, 42, '', {}])('%p vira undefined', value => {
    expect(scrubUrl(value)).toBeUndefined()
  })
})

describe('scrubBreadcrumb', () => {
  it('navegação sem query e HTTP sem query, com status', () => {
    expect(
      scrubBreadcrumb({
        category: 'navigation',
        timestamp: 1,
        data: { from: `/a/${UUID}?x=1`, to: '/b#c' },
      })
    ).toEqual({
      timestamp: 1,
      category: 'navigation',
      data: { from: '/a/:id', to: '/b' },
    })
    const code = fakeInviteCode()
    expect(
      JSON.stringify(
        scrubBreadcrumb({
          category: 'navigation',
          data: { from: '/', to: `/join#${code}` },
        })
      )
    ).not.toContain(code)
    expect(
      scrubBreadcrumb({
        category: 'navigation',
        data: { from: '/', to: `/join#${code}` },
      })
    ).toMatchObject({ data: { to: '/join' } })
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: {
          method: 'POST',
          url: `https://api.test/characters/${UUID}?q=${NOTE}`,
          status_code: 500,
          request_body: NOTE,
        },
      })
    ).toEqual({
      type: 'http',
      category: 'fetch',
      data: {
        method: 'POST',
        url: 'https://api.test/characters/:id',
        status_code: 500,
      },
    })
  })

  it.each(['console', 'ui.click', 'ui.input', 'sentry.event'])(
    'descarta %s',
    category => {
      expect(scrubBreadcrumb({ category, data: { message: NOTE } })).toBeNull()
    }
  )
})

describe('scrubWebEvent', () => {
  const event: EventLike & Record<string, unknown> = {
    event_id: 'abc',
    platform: 'javascript',
    level: 'error',
    release: '1.2.0',
    tags: { source: 'boundary', outra: NOTE, request_id: UUID, status: 'a b' },
    request: { url: `/x?q=${NOTE}`, cookies: { s: NOTE } },
    user: { email: EMAIL },
    extra: { nota: NOTE },
    contexts: { device: { name: NOTE } },
    message: NOTE,
    exception: {
      values: [
        {
          type: 'Error',
          value: `falhou ${EMAIL}`,
          mechanism: { type: 'generic', handled: true },
          stacktrace: {
            frames: [
              {
                filename: `https://app.test/x.js?c=${NOTE}`,
                function: 'f',
                lineno: 1,
                colno: 2,
                in_app: true,
                ...({ vars: { nota: NOTE }, context_line: NOTE } as object),
              },
            ],
          },
        },
      ],
    },
    breadcrumbs: [
      { category: 'ui.click', data: { texto: NOTE } },
      { category: 'navigation', data: { from: '/a', to: `/b?x=${NOTE}` } },
    ],
  }

  it('só os campos da lista', () => {
    const out = scrubWebEvent(event)
    const json = JSON.stringify(out)
    expect(json).not.toContain('vampiro')
    expect(json).not.toContain(EMAIL)
    for (const field of ['request', 'user', 'extra', 'contexts', 'message'])
      expect(out).not.toHaveProperty(field)
    expect(out.tags).toEqual({ source: 'boundary', request_id: UUID })
    expect(out.breadcrumbs).toEqual([
      { category: 'navigation', data: { from: '/a', to: '/b' } },
    ])
    expect(out.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: 'https://app.test/x.js',
      function: 'f',
      lineno: 1,
      colno: 2,
      in_app: true,
    })
  })

  it('mantém só os debug ids de source map, com a URL limpa', () => {
    const out = scrubWebEvent({
      debug_meta: {
        images: [
          {
            type: 'sourcemap',
            code_file: `https://app.test/a.js?x=${NOTE}`,
            debug_id: UUID,
          },
          { type: 'sourcemap', code_file: '/b.js', debug_id: NOTE },
          { type: 'macho', code_file: '/c', debug_id: UUID },
        ],
      },
    })
    expect(out.debug_meta).toEqual({
      images: [
        {
          type: 'sourcemap',
          code_file: 'https://app.test/a.js',
          debug_id: UUID,
        },
      ],
    })
  })

  it('SyntaxError perde a mensagem, que repete a entrada do JSON.parse', () => {
    const out = scrubWebEvent({
      exception: { values: [{ type: 'SyntaxError', value: NOTE }] },
    })
    expect(JSON.stringify(out)).not.toContain('vampiro')
  })

  it('tipo fora do padrão vira Error; evento vazio não quebra', () => {
    expect(
      scrubWebEvent({ exception: { values: [{ type: NOTE }] } }).exception
        ?.values?.[0]?.type
    ).toBe('Error')
    expect(scrubWebEvent({}).exception?.values).toEqual([])
  })
})

describe('createEventLimiter', () => {
  it('deixa passar o máximo e bloqueia o resto', () => {
    const allow = createEventLimiter(3)
    expect([1, 2, 3, 4, 5].map(allow)).toEqual([true, true, true, false, false])
  })

  it('cada aba tem o seu contador', () => {
    const a = createEventLimiter(1)
    const b = createEventLimiter(1)
    expect([a(), a(), b()]).toEqual([true, false, true])
  })
})

describe('toCapture', () => {
  it('5xx do Eden vira Error HTTP, agrupado por status e primeira parte da key', () => {
    const capture = toCapture(
      { status: 500, value: { requestId: UUID, nota: NOTE } },
      { source: 'query', queryKey: ['characters', UUID] }
    )
    expect(capture?.error.message).toBe('HTTP 500')
    expect(capture?.fingerprint).toEqual(['http', '500', 'characters'])
    expect(capture?.tags).toEqual({ source: 'query', request_id: UUID })
    expect(JSON.stringify(capture)).not.toContain('vampiro')
  })

  it('queryKey livre vira unknown', () => {
    expect(
      toCapture(
        { status: 500, value: { requestId: UUID } },
        { source: 'mutation', queryKey: [NOTE] }
      )?.fingerprint
    ).toEqual(['http', '500', 'unknown'])
    expect(
      toCapture(
        { status: 500, value: { requestId: UUID } },
        { source: 'mutation' }
      )?.fingerprint
    ).toEqual(['http', '500', 'unknown'])
  })

  it('o que não é defeito não é capturado', () => {
    expect(
      toCapture({ status: 404, value: { error: 'x' } }, { source: 'query' })
    ).toBeNull()
  })

  it('bug: o próprio erro, com as tags e o fingerprint do contexto', () => {
    const error = new Error('x')
    const capture = toCapture(error, {
      source: 'sync',
      tags: { status: '422' },
      fingerprint: ['sync', 'rejected', '422'],
    })
    expect(capture?.error).toBe(error)
    expect(capture?.tags).toEqual({ source: 'sync', status: '422' })
    expect(capture?.fingerprint).toEqual(['sync', 'rejected', '422'])
  })

  it('valor lançado que não é Error vira um Error sem o valor', () => {
    const capture = toCapture(NOTE, { source: 'boundary' })
    expect(capture?.error.message).toBe('valor lançado: string')
  })
})
