/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'bun'

// O canal `pino_asJson` é a suposição mais frágil da Fase 4, e a falha seria
// silenciosa: os logs apenas parariam de chegar. Por isso o caminho real roda
// num bundle como o do Dockerfile, sem node_modules por perto (§2 do plano). É o
// que pega uma atualização do SDK, do Pino ou do Bun que quebre o canal.

const API = join(import.meta.dir, '../..')
const ENTRY = join(API, 'src/test/telemetry-bundle-entry.ts')
const RELEASE = '9.8.7'
// Produção exige um segredo, que aqui não assina nada
const SECRET = 'x'.repeat(64)
const DSN = 'https://chave@o0.ingest.sentry.test/1'

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tms-telemetry-bundle-'))
  const build = spawn(
    [
      'bun',
      'build',
      ENTRY,
      '--outdir',
      dir,
      '--target',
      'bun',
      '--define',
      `process.env.TMS_RELEASE="${RELEASE}"`,
    ],
    { cwd: API, stdout: 'pipe', stderr: 'pipe' }
  )
  const errors = await new Response(build.stderr).text()
  if ((await build.exited) !== 0) throw new Error(errors)
}, 60_000)

afterAll(() => {
  rmSync(dir, { recursive: true })
})

/** Roda o bundle fora do repo: nada de node_modules para resolver. */
const runBundle = async (dsn: string | undefined, name: string) => {
  const envelopeFile = join(dir, `${name}.jsonl`)
  const { SENTRY_DSN: _ignored, ...base } = process.env
  const proc = spawn(['bun', 'run', join(dir, 'telemetry-bundle-entry.js')], {
    cwd: dir,
    env: {
      ...base,
      NODE_ENV: 'production',
      JWT_SECRET: SECRET,
      ENVELOPE_FILE: envelopeFile,
      ...(dsn ? { BUNDLE_DSN: dsn } : {}),
    },
    stdout: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  expect(await proc.exited).toBe(0)
  return {
    lines: stdout
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as Record<string, unknown>),
    envelopes: existsSync(envelopeFile)
      ? readFileSync(envelopeFile, 'utf8').trim().split('\n')
      : [],
  }
}

type LogItem = { body: string; attributes: Record<string, { value: unknown }> }

const logItems = (envelopes: string[]): LogItem[] =>
  envelopes.flatMap(envelope =>
    (
      (JSON.parse(envelope) as unknown[])[1] as [
        { type?: string },
        { items?: LogItem[] },
      ][]
    )
      .filter(([header]) => header.type === 'log')
      .flatMap(([, payload]) => payload.items ?? [])
  )

describe('no bundle, como no deploy', () => {
  it('as linhas dos dois loggers chegam, filtradas, com o release do build', async () => {
    const { envelopes } = await runBundle(DSN, 'com-dsn')
    const items = logItems(envelopes)

    const api = items.find(
      item => item.attributes.requestId?.value === 'id-do-bundle'
    )
    expect(api?.attributes.name?.value).toBe('api')
    expect(api?.attributes['sentry.release']?.value).toBe(RELEASE)
    expect(api?.attributes).not.toHaveProperty('path')

    const db = items.find(item => item.body === 'do db')
    expect(db?.attributes.name?.value).toBe('db')
    expect(db?.attributes.query?.value).toBe('select $1')

    expect(items.some(item => item.body === 'debug nao sai')).toBe(false)
    expect(envelopes.join('')).not.toContain('/caminho-marcado')
  })

  it('o stdout é o mesmo com e sem a integração', async () => {
    const withoutTime = (lines: Record<string, unknown>[]) =>
      lines.map(({ time: _time, ...line }) => line)
    const on = await runBundle(DSN, 'stdout-com')
    const off = await runBundle(undefined, 'stdout-sem')
    expect(withoutTime(on.lines)).toEqual(withoutTime(off.lines))
    expect(on.lines.map(line => line.msg)).toEqual(['do api', 'do db'])
    expect(on.lines[0]?.path).toBe('/caminho-marcado')
  })

  it('sem DSN, nenhum envelope', async () => {
    expect((await runBundle(undefined, 'sem-dsn')).envelopes).toEqual([])
  })
})
