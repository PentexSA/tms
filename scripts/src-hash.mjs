// S-01: o build de um pacote grava em dist/src-hash.json o hash do conteúdo
// do src (sem testes) e dos tsconfig do pacote. A checagem do ambiente
// (scripts/check-dev-env.mjs) compara esse hash com o do src atual: conteúdo,
// não data. Um `touch`, um `git stash pop` ou o db:codegen com a mesma saída
// não mudam o hash; o turbo e o tsc incremental também não reemitiriam nada.
//
// Uso (no build do pacote): node ../../scripts/src-hash.mjs write .
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

export const STAMP = 'dist/src-hash.json'
const CONFIGS = ['tsconfig.json', 'tsconfig.build.json']

/** Arquivo de teste não entra no dist: não entra no hash. */
const isTest = name => /\.test\.[cm]?[jt]sx?$/.test(name)

/** @param {string} dir */
function files(dir) {
  /** @type {string[]} */
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') out.push(...files(path))
    } else if (!isTest(entry.name)) out.push(path)
  }
  return out
}

/**
 * O hash do que o build lê: os arquivos do src (caminho e conteúdo, em ordem
 * fixa) e os tsconfig do pacote.
 * @param {string} pkgDir pasta do pacote
 */
export function srcHash(pkgDir) {
  const hash = createHash('sha256')
  const inputs = [
    ...files(join(pkgDir, 'src')),
    ...CONFIGS.map(c => join(pkgDir, c)).filter(existsSync),
  ]
    .map(path => relative(pkgDir, path).split(sep).join('/'))
    .sort()
  for (const path of inputs) {
    hash.update(`${path}\0`)
    hash.update(readFileSync(join(pkgDir, path)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

/** O hash gravado no último build, ou null. */
export function readStamp(pkgDir) {
  try {
    const { hash } = JSON.parse(readFileSync(join(pkgDir, STAMP), 'utf8'))
    return typeof hash === 'string' ? hash : null
  } catch {
    return null
  }
}

/** Grava o hash do src atual no dist (depois do tsc). */
export function writeStamp(pkgDir) {
  writeFileSync(
    join(pkgDir, STAMP),
    `${JSON.stringify({ hash: srcHash(pkgDir) })}\n`
  )
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const [command, dir] = process.argv.slice(2)
  if (command !== 'write' || !dir) {
    console.error('Uso: node scripts/src-hash.mjs write <pasta do pacote>')
    process.exit(2)
  }
  writeStamp(resolve(dir))
}
