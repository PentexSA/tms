/// <reference types="bun-types" />
// Fase 3: o upload dos source maps nunca derruba o build e nunca vaza o token.
import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(
  import.meta.dir,
  '../../../../scripts/sentry-sourcemaps.mjs'
)
const TOKEN = 'sntrys_tokencanario123'
const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

/** Um export com um bundle e o map (com o debugId do Metro). */
function setup(options: { failOn?: 'inject' | 'upload'; maps?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tms-sourcemaps-'))
  dirs.push(root)
  const dist = join(root, 'web')
  mkdirSync(join(dist, '_expo'), { recursive: true })
  writeFileSync(join(dist, '_expo/app.js'), 'x()\n//# debugId=antigo\n')
  if (options.maps !== false)
    writeFileSync(
      join(dist, '_expo/app.js.map'),
      JSON.stringify({ version: 3, sources: [], debugId: 'antigo' })
    )
  // O "sentry-cli" de mentira guarda os argumentos e o token recebido
  const calls = join(root, 'calls.log')
  const cli = join(root, 'cli.sh')
  writeFileSync(
    cli,
    `#!/bin/sh
echo "$@ | token=$SENTRY_AUTH_TOKEN" >> "${calls}"
case "$2" in ${options.failOn ?? 'nenhum'}) echo "erro: $SENTRY_AUTH_TOKEN"; exit 1;; esac
`
  )
  chmodSync(cli, 0o755)
  const tokenFile = join(root, 'token')
  writeFileSync(tokenFile, `${TOKEN}\n`)
  const run = (env: Record<string, string> = {}) => {
    const {
      SENTRY_AUTH_TOKEN: _a,
      SENTRY_AUTH_TOKEN_FILE: _b,
      ...base
    } = process.env
    const result = spawnSync('node', [SCRIPT, dist], {
      encoding: 'utf8',
      env: {
        ...base,
        TMS_SENTRY_CLI: cli,
        SENTRY_AUTH_TOKEN_FILE: join(root, 'sem-token'),
        SENTRY_ORG: 'org',
        SENTRY_PROJECT: 'web',
        ...env,
      },
    })
    return {
      code: result.status,
      out: result.stdout + result.stderr,
      calls: (() => {
        try {
          return readFileSync(calls, 'utf8').trim().split('\n')
        } catch {
          return []
        }
      })(),
    }
  }
  return { dist, tokenFile, run }
}

describe('sentry-sourcemaps.mjs', () => {
  it('sem token: registra e sai com 0, sem chamar o CLI', () => {
    const { run } = setup()
    const result = run()
    expect(result.code).toBe(0)
    expect(result.out).toContain('sem token')
    expect(result.calls).toEqual([])
  })

  it('com token (arquivo): limpa o debugId, roda inject e upload, sem --release', () => {
    const { run, dist, tokenFile } = setup()
    const result = run({ SENTRY_AUTH_TOKEN_FILE: tokenFile })
    expect(result.code).toBe(0)
    expect(result.calls).toEqual([
      `sourcemaps inject ${dist} | token=${TOKEN}`,
      `sourcemaps upload ${dist} | token=${TOKEN}`,
    ])
    expect(result.calls.join('\n')).not.toContain('--release')
    expect(readFileSync(join(dist, '_expo/app.js'), 'utf8')).not.toContain(
      'debugId'
    )
    expect(readFileSync(join(dist, '_expo/app.js.map'), 'utf8')).not.toContain(
      'debugId'
    )
    expect(result.out).not.toContain(TOKEN)
  })

  it('o token também pode vir da variável', () => {
    const result = setup().run({ SENTRY_AUTH_TOKEN: TOKEN })
    expect(result.calls).toHaveLength(2)
    expect(result.out).not.toContain(TOKEN)
  })

  it.each(['inject', 'upload'] as const)(
    'falha no %s: sai com 0 e o token não aparece no log',
    failOn => {
      const { run, tokenFile } = setup({ failOn })
      const result = run({ SENTRY_AUTH_TOKEN_FILE: tokenFile })
      expect(result.code).toBe(0)
      expect(result.out).toContain(`${failOn} falhou`)
      expect(result.out).not.toContain(TOKEN)
      // Sem inject, não há upload
      expect(result.calls).toHaveLength(failOn === 'inject' ? 1 : 2)
    }
  )

  it('executável do CLI inexistente: sai com 0', () => {
    const { run, tokenFile } = setup()
    const result = run({
      SENTRY_AUTH_TOKEN_FILE: tokenFile,
      TMS_SENTRY_CLI: '/nao/existe',
    })
    expect(result.code).toBe(0)
    expect(result.out).not.toContain(TOKEN)
  })

  it('sem org ou projeto, ou sem maps: não envia', () => {
    const a = setup()
    const noOrg = a.run({ SENTRY_AUTH_TOKEN_FILE: a.tokenFile, SENTRY_ORG: '' })
    expect(noOrg.code).toBe(0)
    expect(noOrg.calls).toEqual([])
    const b = setup({ maps: false })
    const noMaps = b.run({ SENTRY_AUTH_TOKEN_FILE: b.tokenFile })
    expect(noMaps.code).toBe(0)
    expect(noMaps.out).toContain('nenhum source map')
    expect(noMaps.calls).toEqual([])
  })
})

// O que o Dockerfile e o .dockerignore têm de garantir (não há docker no CI dos
// testes): o token só existe como secret file, no RUN do export, e o upload
// roda entre o web-headers e o delete dos maps.
describe('Dockerfile do Render', () => {
  const root = join(import.meta.dir, '../../../..')
  const dockerfile = readFileSync(
    join(root, 'deploy/render/Dockerfile'),
    'utf8'
  )

  it('o token é secret file opcional, nunca ARG nem ENV', () => {
    expect(dockerfile).toContain(
      '--mount=type=secret,id=sentry_auth_token,required=false'
    )
    expect(dockerfile).not.toMatch(/^\s*(ARG|ENV)\s+SENTRY_AUTH_TOKEN/m)
  })

  it('upload depois do web-headers e antes do delete dos maps', () => {
    const order = [
      'scripts/web-headers.mjs',
      'scripts/sentry-sourcemaps.mjs',
      "find /out/web -name '*.map' -delete",
    ].map(step => dockerfile.indexOf(step))
    expect(order.every(i => i > 0)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('os ARG do Sentry vêm vazios por padrão', () => {
    for (const name of [
      'EXPO_PUBLIC_SENTRY_DSN',
      'EXPO_PUBLIC_SENTRY_SMOKE',
      'SENTRY_ORG',
      'SENTRY_PROJECT',
    ])
      expect(dockerfile).toContain(`ARG ${name}=\n`)
  })

  it('o .dockerignore barra o secret file copiado para o contexto', () => {
    const ignore = readFileSync(join(root, '.dockerignore'), 'utf8').split('\n')
    expect(ignore).toContain('sentry_auth_token')
  })
})
