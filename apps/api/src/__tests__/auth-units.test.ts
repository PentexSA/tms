/// <reference types="bun-types" />
import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { hashPassword, verifyPassword } from '../auth/password'
import { createRateLimiter } from '../http/rate-limit'
import { clientIp } from '../http/security'
import { logger } from '../logger'
import { resolveOptions } from '../options'

describe('senha', () => {
  it('confere a senha certa e recusa a errada', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(
      true
    )
    expect(await verifyPassword('outra senha qualquer', hash)).toBe(false)
  })

  it('sem usuário (hash nulo) sempre nega', async () => {
    expect(await verifyPassword('qualquer coisa', null)).toBe(false)
  })

  it('hash malformado no banco nega em vez de lançar exceção', async () => {
    expect(await verifyPassword('x', 'isto não é um hash')).toBe(false)
  })
})

describe('rate limit', () => {
  it('conta por chave e reabre a janela', () => {
    let t = 0
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: () => t,
    })
    expect(limiter.hit('a').allowed).toBe(true)
    expect(limiter.hit('a').allowed).toBe(true)
    expect(limiter.hit('a')).toEqual({ allowed: false, retryAfterSeconds: 1 })
    expect(limiter.hit('b').allowed).toBe(true)
    t = 1000
    expect(limiter.hit('a').allowed).toBe(true)
  })

  it('check só consulta, sem contar', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 })
    expect(limiter.check('a').allowed).toBe(true)
    expect(limiter.check('a').allowed).toBe(true)
    limiter.hit('a')
    expect(limiter.check('a').allowed).toBe(false)
  })

  it('reset esquece tudo', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    limiter.hit('a')
    limiter.hit('a')
    limiter.reset()
    expect(limiter.hit('a').allowed).toBe(true)
  })

  it('com muitas chaves, descarta as vencidas e depois as mais antigas', () => {
    let t = 0
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: () => t,
      maxKeys: 2,
    })
    limiter.hit('a')
    limiter.hit('a') // a bloqueada
    limiter.hit('b')
    limiter.hit('c') // cheio: descarta a mais antiga (a)
    expect(limiter.hit('a').allowed).toBe(true)
    t = 5000 // todas vencidas: limpa e recomeça
    limiter.hit('d')
    expect(limiter.hit('b').allowed).toBe(true)
  })
})

describe('clientIp', () => {
  const server = { requestIP: () => ({ address: '10.0.0.9' }) }
  const request = (xff?: string) =>
    new Request('http://localhost/', {
      headers: xff ? { 'x-forwarded-for': xff } : {},
    })

  it('sem proxy confiável, ignora o X-Forwarded-For (o cliente forja)', () => {
    expect(clientIp(request('1.1.1.1'), server, false)).toBe('10.0.0.9')
  })

  it('com proxy confiável, usa o último endereço (o que o proxy acrescentou)', () => {
    expect(clientIp(request('6.6.6.6, 1.1.1.1'), server, true)).toBe('1.1.1.1')
    expect(clientIp(request(), server, true)).toBe('10.0.0.9')
  })

  it('sem servidor (testes), uma chave fixa', () => {
    expect(clientIp(request(), null, false)).toBe('local')
  })
})

describe('resolveOptions', () => {
  const original = process.env.JWT_SECRET
  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = original
  })

  it('usa o JWT_SECRET do ambiente quando existe', () => {
    process.env.JWT_SECRET = 'k'.repeat(40)
    expect(resolveOptions().tokens.secret).toEqual(
      new TextEncoder().encode('k'.repeat(40))
    )
  })

  it('sem JWT_SECRET (fora de produção), um segredo aleatório por instância', () => {
    delete process.env.JWT_SECRET
    const a = resolveOptions().tokens.secret
    const b = resolveOptions().tokens.secret
    expect(a).toHaveLength(32)
    expect(a).not.toEqual(b)
  })

  it('em desenvolvimento, avisa que o segredo é aleatório', () => {
    delete process.env.JWT_SECRET
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const warn = spyOn(logger, 'warn')
    try {
      resolveOptions()
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
      process.env.NODE_ENV = env
    }
  })

  it('fora de produção: swagger ligado e cookie sem Secure (localhost)', () => {
    const options = resolveOptions()
    expect(options.now()).toBeInstanceOf(Date)
    expect(options.limits.login.hit('x').allowed).toBe(true)
    expect(options.swagger).toBe(true)
    expect(options.secureCookies).toBe(false)
  })
})
