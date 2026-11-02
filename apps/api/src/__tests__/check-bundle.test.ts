/// <reference types="bun-types" />
// S-01: com o Metro lendo o src dos pacotes, a barreira contra código de
// servidor no bundle web (scripts/check-bundle.mjs) precisa ler os source
// maps do Metro do SDK 58, que vêm em seções (index map). Antes ela lia 0
// módulos e aprovava qualquer bundle.
import { afterEach, describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(import.meta.dir, '../../../../scripts/check-bundle.mjs')
const dirs: string[] = []

function exportWith(map: unknown) {
  const dir = mkdtempSync(join(tmpdir(), 'tms-bundle-'))
  dirs.push(dir)
  writeFileSync(join(dir, 'index.js.map'), JSON.stringify(map))
  return dir
}

function run(dir: string) {
  const result = spawnSync('node', [SCRIPT, dir], { encoding: 'utf8' })
  return { code: result.status, out: result.stdout + result.stderr }
}

const sections = (sources: string[]) => ({
  version: 3,
  sections: [
    { offset: { line: 0, column: 0 }, map: { version: 3, sources: [] } },
    { offset: { line: 1, column: 0 }, map: { version: 3, sources } },
  ],
})

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true })
})

describe('check-bundle.mjs', () => {
  it('lê os módulos de um index map (seções)', () => {
    const result = run(
      exportWith(sections(['/repo/packages/sheet-core/src/index.ts']))
    )
    expect(result.code).toBe(0)
    expect(result.out).toContain('1 módulos, nenhum de servidor')
  })

  it('acusa código de servidor dentro de uma seção', () => {
    const result = run(
      exportWith(
        sections([
          '/repo/packages/ui/src/index.ts',
          '/repo/packages/db/src/index.ts',
        ])
      )
    )
    expect(result.code).toBe(1)
    expect(result.out).toContain('packages/db/src/index.ts')
  })

  it('continua lendo o formato antigo (sources na raiz)', () => {
    const result = run(
      exportWith({ version: 3, sources: ['/repo/node_modules/kysely/x.js'] })
    )
    expect(result.code).toBe(1)
    expect(result.out).toContain('node_modules/kysely/x.js')
  })

  it('falha se não leu nenhum módulo', () => {
    const result = run(exportWith({ version: 3, sections: [] }))
    expect(result.code).toBe(1)
    expect(result.out).toContain('Nenhum módulo nos source maps')
  })
})
