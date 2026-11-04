/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import * as Sentry from '@sentry/bun'
import { sleep } from 'bun'
import type { LogEvent } from 'kysely'
import {
  logger as dbLogger,
  kyselyLogger,
} from '../../../../packages/db/src/logger'
import { logger } from '../logger'
import {
  initTelemetry,
  resetTelemetry,
  scrubLog,
  sendSmokeError,
} from '../telemetry'
import { as, createUser } from '../test/factories'
import { createTestContext, useTestDb } from '../test/helpers'
import {
  BEARER_TOKEN,
  BODY_VALUE,
  CANARIES,
  COOKIE,
  DB_PASSWORD,
  DSN,
  EMAIL,
  fakeTransport,
  HEADER_VALUE,
  JWT,
  NOTE,
  QUERY_VALUE,
} from '../test/telemetry-canary'

// A Fase 4 na app real: o que o Sentry recebe do Pino. Três cuidados:
// - Com NODE_ENV=test o nível é `silent`: o Pino não gera a linha, o canal não
//   dispara e um canário sobre o envelope vazio passaria sempre. Aqui o nível
//   sobe, e cada teste confere primeiro que a linha esperada chegou. O preço são
//   algumas linhas de log na saída do teste.
// - Cada Sentry.init soma um assinante ao canal, que nunca sai, e o `bun test`
//   compartilha o processo entre arquivos: um init por arquivo, e nunca contar
//   linhas.
// - O lote só sai em 5 s: Sentry.flush antes de ler o transporte.

useTestDb()

const { sent, transport } = fakeTransport()

type Attribute = { value: unknown; type: string }
interface LogItem {
  readonly level: string
  readonly body: string
  readonly attributes: Record<string, Attribute>
}

interface SentEvent {
  readonly tags?: Record<string, string>
  readonly exception: { readonly values: { readonly value?: string }[] }
}
type EnvelopeItem = [{ type?: string }, { items?: LogItem[] } & SentEvent]

const itemsOf = (envelope: string, type: string) =>
  ((JSON.parse(envelope) as unknown[])[1] as EnvelopeItem[])
    .filter(([header]) => header.type === type)
    .map(([, payload]) => payload)

/** Só as linhas de log: o evento do issue passa pelo filtro da Fase 3. */
const logEnvelopes = (): string[] =>
  sent.filter(envelope => itemsOf(envelope, 'log').length > 0)

const logItems = (): LogItem[] =>
  sent.flatMap(envelope =>
    itemsOf(envelope, 'log').flatMap(payload => payload.items ?? [])
  )

const eventsOf = (): SentEvent[] =>
  sent.flatMap(envelope => itemsOf(envelope, 'event'))

/** Espera a linha: o log de acesso sai depois de o `handle` devolver a resposta. */
const waitFor = async (match: (item: LogItem) => boolean): Promise<LogItem> => {
  for (let i = 0; i < 100; i++) {
    await Sentry.flush(100)
    const found = logItems().find(match)
    if (found) return found
    await sleep(5)
  }
  throw new Error('a linha esperada não chegou')
}

const byId = (requestId: string | null) => (item: LogItem) =>
  item.attributes.requestId?.value === requestId

/** O que o SDK acrescenta depois do filtro, em toda linha. */
const SDK_KEYS = [
  'sentry.origin',
  'sentry.release',
  'sentry.environment',
  'sentry.sdk.name',
  'sentry.sdk.version',
  'sentry.timestamp.sequence',
  'server.address',
]
const keysOf = (item: LogItem) =>
  Object.keys(item.attributes)
    .filter(key => !SDK_KEYS.includes(key))
    .sort()

const canaryApp = async () => {
  const ctx = await createTestContext()
  const app = ctx.app
    .all('/ok/:id', () => ({ ok: true }))
    .all('/boom/:id', () => {
      throw new Error(
        `falhou ${EMAIL} ${JWT} Bearer ${BEARER_TOKEN} ${NOTE} postgres://u:${DB_PASSWORD}@db/tms`,
        { cause: new Error(`dentro ${NOTE}`) }
      )
    })
  const user = await createUser(ctx)
  const handle = (path: string, init: RequestInit = {}) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        ...init,
        headers: {
          ...user.headers,
          ...(init.headers as Record<string, string>),
        },
      })
    )
  return { ctx, handle, user }
}

const idOf = (res: Response) => res.headers.get('x-request-id') as string

beforeAll(() => {
  logger.level = 'info'
  dbLogger.level = 'info'
})

afterAll(async () => {
  logger.level = 'silent'
  dbLogger.level = 'silent'
  await resetTelemetry()
})

// Antes do único init do arquivo
describe('sem init', () => {
  it('sem DSN não liga, e a linha do Pino não vai a lugar nenhum', async () => {
    expect(initTelemetry({ dsn: '', transport })).toBe(false)
    logger.info('linha sem init')
    await Sentry.flush(50)
    expect(sent).toEqual([])
  })
})

describe('com o Sentry ligado', () => {
  beforeAll(() => {
    expect(initTelemetry({ dsn: DSN, transport })).toBe(true)
  })

  describe('canário na app real, sobre o envelope serializado', () => {
    // O caminho do Elysia sai como veio na URL: o texto também vale codificado
    const MARKED = [EMAIL, JWT, BEARER_TOKEN, NOTE, DB_PASSWORD]
    const markedPath = MARKED.map(encodeURIComponent).join('--')
    const ALL_CANARIES = [
      ...CANARIES,
      ...CANARIES.map(encodeURIComponent),
      'caminhocanario555',
    ]
    const leaks = () => {
      const json = logEnvelopes().join('')
      return ALL_CANARIES.filter(canary => json.includes(canary))
    }
    const request = {
      method: 'POST',
      headers: {
        'x-outro-token': `Bearer ${BEARER_TOKEN}`,
        cookie: COOKIE,
        'x-segredo': HEADER_VALUE,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ senha: BODY_VALUE, nota: NOTE, email: EMAIL }),
    }

    it.each([
      ['200', '/ok', 200, 'POST /ok/:id - 200'],
      ['500 que lança os valores', '/boom', 500, 'POST /boom/:id - 500'],
      ['404', '/nao-existe', 404, 'POST rota desconhecida - 404'],
    ])('%s', async (_, prefix, status, body) => {
      const { handle, user } = await canaryApp()
      const res = await handle(
        `${prefix}/caminhocanario555-${markedPath}?q=${QUERY_VALUE}&e=${EMAIL}`,
        request
      )
      expect(res.status).toBe(status)
      const line = await waitFor(
        item =>
          byId(idOf(res))(item) && item.attributes.status?.value === status
      )
      expect(line.body).toBe(body)
      expect(leaks()).toEqual([])
      expect(logEnvelopes().join('')).not.toContain(
        (user.headers.authorization as string).replace('Bearer ', '')
      )
    })

    it('o stack e a mensagem do 500 não saem no log', async () => {
      const { handle } = await canaryApp()
      const res = await handle('/boom/abc')
      const line = await waitFor(
        item => byId(idOf(res))(item) && item.body === 'erro interno'
      )
      expect(line.attributes.error?.value).toBe('Error')
      const json = JSON.stringify(line)
      expect(json).not.toContain('falhou')
      expect(json).not.toContain('telemetry-logs')
      expect(leaks()).toEqual([])
    })

    it('logger.error(erro): o texto do erro não vira corpo', async () => {
      logger.error(new Error(`nota ${NOTE} ${EMAIL} textodoerro`))
      const line = await waitFor(item => item.body === 'erro sem filtro')
      expect(line.level).toBe('error')
      expect(logEnvelopes().join('')).not.toContain('textodoerro')
      expect(leaks()).toEqual([])
    })
  })

  describe('campos por origem: um campo novo não sai até entrar na lista', () => {
    it('log de acesso', async () => {
      const { handle } = await canaryApp()
      const res = await handle('/ok/abc', {
        headers: { 'x-tms-client-version': '1.2.3' },
      })
      const line = await waitFor(byId(idOf(res)))
      expect(keysOf(line)).toEqual([
        'clientVersion',
        'method',
        'name',
        'requestId',
        'responseTime',
        'route',
        'status',
      ])
      expect(line.level).toBe('info')
      expect(line.body).toBe('GET /ok/:id - 200')
      expect(line.attributes.clientVersion?.value).toBe('1.2.3')
      expect(line.attributes['sentry.origin']?.value).toBe('auto.log.pino')
      expect(line.attributes['server.address']?.value).toBe('tms-api')
    })

    it('404: sem rota, em vez do texto "null"', async () => {
      const { handle } = await canaryApp()
      const res = await handle('/nao-existe/abc')
      const line = await waitFor(byId(idOf(res)))
      expect(line.attributes.error?.value).toBe('NOT_FOUND')
      expect(keysOf(line)).toEqual([
        'clientVersion',
        'error',
        'method',
        'name',
        'requestId',
        'responseTime',
        'status',
      ])
      expect(line.body).toBe('GET rota desconhecida - 404')
    })

    it('erro interno e o acesso do 500', async () => {
      const { handle } = await canaryApp()
      const res = await handle('/boom/abc')
      const detail = await waitFor(
        item => byId(idOf(res))(item) && item.body === 'erro interno'
      )
      expect(detail.level).toBe('error')
      expect(keysOf(detail)).toEqual(['error', 'name', 'requestId'])
      const access = await waitFor(
        item => byId(idOf(res))(item) && item.attributes.method !== undefined
      )
      expect(access.level).toBe('error')
      expect(keysOf(access)).toEqual([
        'clientVersion',
        'error',
        'method',
        'name',
        'requestId',
        'responseTime',
        'route',
        'status',
      ])
      expect(access.attributes.error?.value).toBe('Error')
    })

    it('account.deleted: sem userId, que fica só no stdout', async () => {
      const { ctx } = await canaryApp()
      const user = await createUser(ctx, 'quem-sai')
      const res = await as(ctx, user, 'DELETE', '/me', {
        password: 'senha de teste longa o bastante',
      })
      expect(res.status).toBe(204)
      const line = await waitFor(
        item => item.attributes.event?.value === 'account.deleted'
      )
      expect(keysOf(line)).toEqual([
        'characters',
        'chronicles',
        'event',
        'name',
      ])
      expect(line.body).toBe('conta excluída')
      expect(JSON.stringify(line)).not.toContain(user.id)
    })

    it('query lenta: SQL com placeholders, sem os parâmetros', async () => {
      kyselyLogger({
        level: 'query',
        query: {
          sql: 'select * from users where email = $1',
          parameters: [EMAIL],
        },
        queryDurationMillis: 750,
      } as unknown as LogEvent)
      const line = await waitFor(item => item.body === 'query lenta')
      expect(line.level).toBe('warn')
      expect(keysOf(line)).toEqual(['duration', 'name', 'query'])
      expect(line.attributes.name?.value).toBe('db')
      expect(line.attributes.query?.value).toBe(
        'select * from users where email = $1'
      )
      expect(JSON.stringify(line)).not.toContain(EMAIL)
    })
  })

  describe('ligação entre log e issue', () => {
    it('num 500, o id é o mesmo no log, na tag do evento e na resposta', async () => {
      const { handle } = await canaryApp()
      const res = await handle('/boom/abc')
      const { requestId } = (await res.json()) as { requestId: string }
      expect(idOf(res)).toBe(requestId)
      await waitFor(
        item => byId(requestId)(item) && item.body === 'erro interno'
      )
      const event = eventsOf().find(e => e.tags?.request_id === requestId)
      expect(event).toBeDefined()
      expect(event?.tags?.route).toBe('/boom/:id')
    })

    it('um erro do Pino não vira issue: só o 500 do onError', async () => {
      await Sentry.flush(100)
      const before = eventsOf().length
      const marker = crypto.randomUUID()
      logger.error({ requestId: marker }, 'erro só de log')
      await waitFor(byId(marker))
      await Sentry.flush(100)
      expect(eventsOf()).toHaveLength(before)
    })

    it('o smoke envia log e issue com o mesmo id', async () => {
      await sendSmokeError()
      const line = await waitFor(item => item.body === 'sentry smoke')
      const requestId = line.attributes.requestId?.value as string
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
      const event = eventsOf().find(e => e.tags?.request_id === requestId)
      expect(event?.exception.values.at(-1)?.value).toBe('sentry smoke')
      expect(line.level).toBe('error')
    })
  })

  describe('o que não sai', () => {
    it('/health não gera log', async () => {
      const { handle } = await canaryApp()
      const res = await handle('/health')
      expect(res.status).toBe(200)
      const after = await handle('/ok/depois')
      await waitFor(byId(idOf(after)))
      expect(logItems().some(byId(idOf(res)))).toBe(false)
    })

    it('debug não sai, mesmo com o Pino nesse nível', async () => {
      const marker = crypto.randomUUID()
      logger.level = 'debug'
      try {
        logger.debug({ requestId: `debug-${marker}` }, 'linha de debug')
        logger.info({ requestId: marker }, 'linha de info')
      } finally {
        logger.level = 'info'
      }
      await waitFor(byId(marker))
      expect(logItems().some(byId(`debug-${marker}`))).toBe(false)
    })
  })
})

describe('scrubLog', () => {
  const scrub = (attributes: Record<string, unknown>, message = 'texto fixo') =>
    scrubLog({ level: 'info', message, attributes })

  it('descarta campo fora da lista', () => {
    const log = scrub({
      name: 'api',
      path: '/x',
      msg: 'y',
      userId: 'u',
      service: 'tms-api',
      release: '1.0.0',
      'pino.logger.level': 30,
      'user.email': EMAIL,
      novo: NOTE,
    })
    expect(log.attributes).toEqual({ name: 'api' })
  })

  it('omite null e undefined, que virariam o texto "null"', () => {
    const log = scrub({
      requestId: null,
      route: null,
      status: null,
      x: undefined,
    })
    expect(log.attributes).toEqual({})
  })

  it('número só finito, e método só no formato', () => {
    const log = scrub({
      status: '200',
      duration: Number.NaN,
      responseTime: 12,
      method: `GET ${NOTE}`,
    })
    expect(log.attributes).toEqual({ responseTime: 12 })
  })

  it('error em objeto vira só o tipo, nunca mensagem nem stack', () => {
    const error = {
      name: 'TypeError',
      message: NOTE,
      stack: `at ${NOTE}`,
      cause: { message: NOTE },
    }
    expect(scrub({ error }).attributes).toEqual({ error: 'TypeError' })
    expect(scrub({ error: { ...error, code: '23505' } }).attributes).toEqual({
      error: '23505',
    })
    expect(scrub({ error: NOTE }).attributes).toEqual({})
    expect(scrub({ error: { name: NOTE } }).attributes).toEqual({})
    expect(scrub({ error: 'x'.repeat(65) }).attributes).toEqual({})
  })

  it('query limitada a 500 caracteres, e redigida', () => {
    const query = scrub({ query: 's'.repeat(600) }).attributes?.query as string
    expect(query).toHaveLength(500)
    expect(scrub({ query: `select '${EMAIL}'` }).attributes?.query).toBe(
      "select '[email]'"
    )
  })

  it('texto limitado a 100 caracteres, e redigido', () => {
    expect(scrub({ route: 'r'.repeat(101) }).attributes?.route).toHaveLength(
      100
    )
    expect(scrub({ event: JWT }).attributes?.event).toBe('[jwt]')
  })

  it('copia os atributos do SDK, sem o nível do Pino', () => {
    const sdk = {
      'sentry.origin': 'auto.log.pino',
      'sentry.release': '1.2.0',
      'sentry.environment': 'production',
      'sentry.sdk.name': 'sentry.javascript.bun',
      'sentry.sdk.version': '11.8.0',
      'server.address': 'tms-api',
    }
    expect(scrub({ ...sdk, 'pino.logger.level': 30 }).attributes).toEqual(sdk)
  })

  it('a mensagem do acesso é refeita sem o caminho', () => {
    const raw = `GET /convite/${EMAIL} - 200`
    expect(
      scrub({ method: 'GET', route: '/x/:id', status: 200, path: '/y' }, raw)
        .message
    ).toBe('GET /x/:id - 200')
    expect(
      scrub({ method: 'GET', route: null, status: 404, path: '/y' }, raw)
        .message
    ).toBe('GET rota desconhecida - 404')
  })

  it('sem status ou com método inválido, o caminho também não passa', () => {
    const raw = `GET /convite/segredo - status desconhecido`
    expect(
      scrub({ method: 'GET', route: null, status: null, path: '/y' }, raw)
        .message
    ).toBe('GET rota desconhecida - status desconhecido')
    expect(scrub({ method: 'get/x', status: 200 }, raw).message).toBe(
      'método desconhecido rota desconhecida - 200'
    )
    expect(scrub({ path: '/y' }, raw).message).toBe(
      'método desconhecido rota desconhecida - status desconhecido'
    )
  })

  it('com `err`, o texto do erro não sai', () => {
    const log = scrub({ err: { message: NOTE, stack: NOTE } }, `oi ${NOTE}`)
    expect(log.message).toBe('erro sem filtro')
    expect(log.attributes).toEqual({})
  })

  it('as demais mensagens passam por redação e limite', () => {
    expect(scrub({}, `oi ${EMAIL} ${JWT}`).message).toBe('oi [email] [jwt]')
    expect(scrub({}, 'm'.repeat(400)).message).toHaveLength(300)
    expect(scrubLog({ level: 'info', message: '' }).message).toBe('')
  })

  it('o nível é mantido, e o resto do log do SDK não passa', () => {
    const log = scrubLog({
      level: 'warn',
      message: 'x',
      severityNumber: 13,
      attributes: {},
    })
    expect(log).toEqual({ level: 'warn', message: 'x', attributes: {} })
  })
})

describe('barreiras no código', () => {
  const SRC = join(import.meta.dir, '..')
  const DB_SRC = join(import.meta.dir, '../../../../packages/db/src')

  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const path = join(dir, name)
      if (statSync(path).isDirectory())
        return name === '__tests__' || name === 'test' ? [] : sources(path)
      return path.endsWith('.ts') ? [path] : []
    })
  const matching = (dir: string, pattern: RegExp) =>
    sources(dir)
      .filter(path => pattern.test(readFileSync(path, 'utf8')))
      .map(path => path.slice(dir.length + 1))

  it('as listas não estão vazias', () => {
    expect(sources(SRC)).toContain(join(SRC, 'server.ts'))
    expect(sources(DB_SRC)).toContain(join(DB_SRC, 'migrate.ts'))
  })

  it('só o server.ts chama initTelemetry', () => {
    expect(matching(SRC, /\binitTelemetry\(/).sort()).toEqual([
      'server.ts',
      'telemetry.ts',
    ])
  })

  it('packages/db não importa o Sentry: o migrate.ts loga o erro cru', () => {
    expect(matching(DB_SRC, /@sentry/)).toEqual([])
  })

  it('a API não usa sql.lit nem sql.raw, que levariam valores ao campo query', () => {
    expect(matching(SRC, /\bsql\.(lit|raw)\b/)).toEqual([])
  })
})
