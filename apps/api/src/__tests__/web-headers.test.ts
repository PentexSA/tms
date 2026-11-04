/// <reference types="bun-types" />
// Fase 3: a CSP do app web libera a origem do DSN do Sentry, e só ela, depois da
// origem da API. DSN inválido avisa e não derruba o build.
import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(import.meta.dir, '../../../../scripts/web-headers.mjs')
const dirs: string[] = []

function run(dsn: string | undefined) {
  const dir = mkdtempSync(join(tmpdir(), 'tms-headers-'))
  dirs.push(dir)
  const { EXPO_PUBLIC_SENTRY_DSN: _, ...env } = process.env
  const result = spawnSync('node', [SCRIPT, dir, 'https://api.tms.test/x'], {
    encoding: 'utf8',
    env: {
      ...env,
      ...(dsn === undefined ? {} : { EXPO_PUBLIC_SENTRY_DSN: dsn }),
    },
  })
  const headers = readFileSync(join(dir, '_headers'), 'utf8')
  const connect = /connect-src ([^;]*)/.exec(headers)?.[1]
  return { code: result.status, out: result.stdout + result.stderr, connect }
}

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('web-headers.mjs: connect-src', () => {
  it('sem DSN, só a origem da API', () => {
    expect(run(undefined).connect).toBe("'self' https://api.tms.test")
    expect(run('').connect).toBe("'self' https://api.tms.test")
  })

  it('com DSN, a origem dele depois da da API (sem chave nem caminho)', () => {
    const { connect, out } = run('https://chave@o123.ingest.de.sentry.io/456')
    expect(connect).toBe(
      "'self' https://api.tms.test https://o123.ingest.de.sentry.io"
    )
    expect(out).not.toContain('chave')
  })

  it.each(['lixo', 'ftp://chave@host/1'])(
    'DSN inválido (%s): avisa e segue sem a origem',
    dsn => {
      const { code, out, connect } = run(dsn)
      expect(code).toBe(0)
      expect(out).toContain('EXPO_PUBLIC_SENTRY_DSN inválido')
      expect(connect).toBe("'self' https://api.tms.test")
    }
  )
})
