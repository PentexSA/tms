/// <reference types="bun-types" />
// S-03: o Postgres de desenvolvimento (docker-compose.yml) usa a mesma tag do
// CI e só aceita conexão do loopback.
// S-04: o .env.example funciona copiado como está e não traz segredo.
import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '../../../..')
const compose = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8')
const example = readFileSync(join(ROOT, '.env.example'), 'utf8')

/** As linhas CHAVE=valor do arquivo (comentários e linhas vazias fora). */
function parseEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m?.[1] !== undefined) env[m[1]] = m[2] ?? ''
  }
  return env
}

/** Uma variável do serviço postgres do compose. */
const composeVar = (name: string) =>
  new RegExp(`^\\s*${name}:\\s*(\\S+)\\s*$`, 'm').exec(compose)?.[1]

describe('.env.example (S-04)', () => {
  const originalEnv = process.env
  afterEach(() => {
    process.env = originalEnv
  })

  it('passa no schema do config copiado como está', async () => {
    process.env = { ...parseEnv(example), NODE_ENV: 'test' }
    const error = spyOn(console, 'error').mockImplementation(() => undefined)
    const { config } = await import('../env')
    expect(config.DATABASE_URL).toBe(
      'postgres://postgres:postgres@localhost:5432/tms'
    )
    expect(config.API_PORT).toBe(3001)
    expect(config.JWT_SECRET).toBeUndefined()
    expect(config.TRUST_PROXY).toBe(false)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('não tem JWT_SECRET com valor (nem vazio, que reprova no schema)', () => {
    expect(parseEnv(example)).not.toHaveProperty('JWT_SECRET')
    expect(example).toMatch(/^# JWT_SECRET=$/m)
  })

  it('o DATABASE_URL aponta para o Postgres do docker-compose.yml', () => {
    const url = new URL(parseEnv(example).DATABASE_URL ?? '')
    const [, port] = /"[^"]*:(\d+):5432"/.exec(compose) ?? []
    expect(url.hostname).toBe('localhost')
    expect(url.port).toBe(port ?? '')
    expect(url.username).toBe(composeVar('POSTGRES_USER') ?? '')
    expect(url.password).toBe(composeVar('POSTGRES_PASSWORD') ?? '')
    expect(url.pathname).toBe(`/${composeVar('POSTGRES_DB')}`)
  })
})

describe('docker-compose.yml (S-03)', () => {
  it('a imagem do Postgres tem tag, a mesma do CI', () => {
    const images = [...compose.matchAll(/^\s*image:\s*(\S+)\s*$/gm)].map(
      m => m[1]
    )
    expect(images).toEqual(['postgres:16'])
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')
    const ciImages = new Set(
      [...ci.matchAll(/^\s*image:\s*(postgres\S*)\s*$/gm)].map(m => m[1])
    )
    expect([...ciImages]).toEqual(['postgres:16'])
  })

  it('a porta é publicada só no loopback', () => {
    const ports = [...compose.matchAll(/^\s*-\s*"([^"]*:5432)"\s*$/gm)].map(
      m => m[1]
    )
    expect(ports).toEqual(['127.0.0.1:5432:5432'])
  })
})
