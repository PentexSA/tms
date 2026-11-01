/// <reference types="bun-types" />
// S-03: o Postgres de desenvolvimento (docker-compose.yml) usa a mesma tag do
// CI e só aceita conexão do loopback.
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '../../../..')
const compose = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8')

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
