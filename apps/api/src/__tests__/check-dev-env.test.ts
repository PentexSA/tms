/// <reference types="bun-types" />
// S-01 e S-02: a API e o web se recusam a subir com dependências diferentes
// do lockfile ou com o dist de um pacote mais velho que o código, e dizem o
// comando. Os scripts são da raiz (scripts/); ficam testados aqui porque a
// API já roda Bun.
import { afterEach, describe, expect, it } from 'bun:test'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  checkDevEnv,
  checkDist,
  checkLockfile,
  parseArgs,
} from '../../../../scripts/check-dev-env.mjs'
import {
  readStamp,
  srcHash,
  writeStamp,
} from '../../../../scripts/src-hash.mjs'

const roots: string[] = []
const LOCK = 'lockfileVersion: 9.0\n'

function fakeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'tms-devenv-'))
  roots.push(root)
  return root
}

function write(root: string, file: string, content: string, time?: number) {
  const path = join(root, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  if (time !== undefined) utimesSync(path, time, time)
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true })
})

describe('checkLockfile (S-02)', () => {
  it('passa com o lockfile instalado igual ao do repositório', () => {
    const root = fakeRoot()
    write(root, 'pnpm-lock.yaml', LOCK)
    write(root, 'node_modules/.pnpm/lock.yaml', LOCK)
    expect(checkLockfile(root)).toBeNull()
  })

  it('recusa lockfile divergente ou instalação ausente, com o comando', () => {
    const root = fakeRoot()
    write(root, 'pnpm-lock.yaml', LOCK)
    const message =
      'Dependências diferentes do pnpm-lock.yaml. Rode: pnpm bootstrap'
    expect(checkLockfile(root)).toBe(message)
    write(root, 'node_modules/.pnpm/lock.yaml', `${LOCK}# antigo\n`)
    expect(checkLockfile(root)).toBe(message)
  })
})

describe('checkDist (S-01): hash do conteúdo, não data', () => {
  const old = 1_700_000_000
  const recent = old + 60
  const PKG = 'packages/sheet-core'

  function built(root: string) {
    write(root, `${PKG}/src/index.ts`, 'export const a = 1\n', old)
    write(root, `${PKG}/tsconfig.json`, '{}', old)
    write(root, `${PKG}/dist/index.js`, 'x', old)
    writeStamp(join(root, PKG))
  }

  it('passa logo depois do build', () => {
    const root = fakeRoot()
    built(root)
    expect(checkDist(root, ['sheet-core'])).toEqual([])
  })

  it('salvar sem mudar nada (data nova, mesmo conteúdo) não recusa', () => {
    const root = fakeRoot()
    built(root)
    write(root, `${PKG}/src/index.ts`, 'export const a = 1\n', recent)
    expect(checkDist(root, ['sheet-core'])).toEqual([])
  })

  it('codegen que regrava o arquivo com a mesma saída não recusa', () => {
    const root = fakeRoot()
    write(root, 'packages/db/src/types.ts', 'export interface DB {}\n', old)
    write(root, 'packages/db/dist/index.js', 'x', old)
    writeStamp(join(root, 'packages/db'))
    write(root, 'packages/db/src/types.ts', 'export interface DB {}\n', recent)
    expect(checkDist(root, ['db'])).toEqual([])
  })

  it('mudança de verdade no src ou no tsconfig recusa, com o comando', () => {
    const message =
      'O build de @tms/sheet-core está mais velho que o código. Rode: pnpm bootstrap'
    const root = fakeRoot()
    built(root)
    write(root, `${PKG}/src/index.ts`, 'export const a = 2\n', old)
    expect(checkDist(root, ['sheet-core'])).toEqual([message])
    const other = fakeRoot()
    built(other)
    write(other, `${PKG}/src/novo.ts`, 'export {}\n', old)
    expect(checkDist(other, ['sheet-core'])).toEqual([message])
    const config = fakeRoot()
    built(config)
    write(config, `${PKG}/tsconfig.json`, '{"compilerOptions":{}}', old)
    expect(checkDist(config, ['sheet-core'])).toEqual([message])
  })

  it('sem o carimbo (dist ausente ou de antes dele) recusa', () => {
    const root = fakeRoot()
    write(root, `${PKG}/src/index.ts`, 'x')
    write(root, 'packages/db/src/index.ts', 'x')
    write(root, 'packages/db/dist/index.js', 'x')
    expect(checkDist(root, ['sheet-core', 'db'])).toEqual([
      'O build de @tms/sheet-core está mais velho que o código. Rode: pnpm bootstrap',
      'O build de @tms/db está mais velho que o código. Rode: pnpm bootstrap',
    ])
  })

  it('testes no src não contam', () => {
    const root = fakeRoot()
    write(root, 'packages/config/src/env.ts', 'x')
    write(root, 'packages/config/dist/env.js', 'x')
    writeStamp(join(root, 'packages/config'))
    write(root, 'packages/config/src/__tests__/env.test.ts', 'novo')
    write(root, 'packages/config/src/env.pg.test.ts', 'novo')
    expect(checkDist(root, ['config'])).toEqual([])
    expect(readStamp(join(root, 'packages/config'))).toBe(
      srcHash(join(root, 'packages/config'))
    )
  })

  it('pacote sem src é recusado', () => {
    const root = fakeRoot()
    expect(checkDist(root, ['nada'])).toEqual([
      'packages/nada/src não existe (pacote desconhecido?)',
    ])
  })
})

describe('checkDevEnv e argumentos', () => {
  it('junta os dois e só olha o dist pedido', () => {
    const root = fakeRoot()
    write(root, 'pnpm-lock.yaml', LOCK)
    write(root, 'node_modules/.pnpm/lock.yaml', LOCK)
    write(root, 'packages/ui/src/index.ts', 'x')
    expect(checkDevEnv(root)).toEqual([])
    expect(checkDevEnv(root, { dist: ['ui'] })).toHaveLength(1)
  })

  it('lê --root e --dist e recusa argumento desconhecido', () => {
    expect(parseArgs(['--root', '/r', '--dist', 'db', 'config'])).toEqual({
      root: '/r',
      dist: ['db', 'config'],
    })
    expect(() => parseArgs(['--fix'])).toThrow('Argumento desconhecido')
    expect(() => parseArgs(['--dist', 'db', '--fix'])).toThrow(
      'Argumento desconhecido'
    )
  })

  it('--root sem valor é erro de uso', () => {
    expect(() => parseArgs(['--root'])).toThrow('--root sem valor. Uso:')
    expect(() => parseArgs(['--root', '--dist', 'db'])).toThrow(
      '--root sem valor'
    )
  })
})
