/// <reference types="bun-types" />

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'bun'

// A linha que o Pino escreve de verdade, em outro processo: nos testes o nível
// é `silent`, e o spy vê o objeto antes do formato.

const SCRIPT = `
  import { createLogger } from '@tms/logger'
  createLogger({ name: 'api' }).error({ requestId: 'x' }, 'teste')
`

// Produção exige um segredo, que aqui não assina nada
const SECRET = 'x'.repeat(64)

const lineWith = async (env: Record<string, string>) => {
  const { TMS_RELEASE: _ignored, ...base } = process.env
  const proc = spawn(['bun', '-e', SCRIPT], {
    cwd: join(import.meta.dir, '../..'),
    env: { ...base, NODE_ENV: 'production', JWT_SECRET: SECRET, ...env },
    stdout: 'pipe',
  })
  const out = await new Response(proc.stdout).text()
  expect(await proc.exited).toBe(0)
  return JSON.parse(out.trim()) as Record<string, unknown>
}

describe('a linha de log', () => {
  it('tem horário ISO 8601, service e o componente no name, sem pid', async () => {
    const line = await lineWith({})
    expect(line.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(line.service).toBe('tms-api')
    expect(line.name).toBe('api')
    expect(line.level).toBe(50)
    expect(line).not.toHaveProperty('pid')
    expect(line).not.toHaveProperty('hostname')
  })

  it('release vem do TMS_RELEASE, e o padrão é dev', async () => {
    expect((await lineWith({})).release).toBe('dev')
    expect((await lineWith({ TMS_RELEASE: '9.9.9' })).release).toBe('9.9.9')
  })

  it('o bundle do deploy injeta o release', () => {
    const dockerfile = readFileSync(
      join(import.meta.dir, '../../../../deploy/render/Dockerfile'),
      'utf8'
    )
    expect(dockerfile).toContain('process.env.TMS_RELEASE')
  })
})
