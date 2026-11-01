// S-01 e S-02: a API e o web se recusam a subir com dependências ou build
// desatualizados, e dizem o comando que resolve. Só checa; não instala nem
// compila nada.
//
// - Dependências (S-02): o lockfile que o pnpm grava do que instalou
//   (node_modules/.pnpm/lock.yaml, também com nodeLinker: hoisted) tem de ser
//   igual ao pnpm-lock.yaml.
// - Build (S-01, só para quem lê o dist: a API, as migrations e os scripts no
//   Bun): com --dist, o hash que o build gravou em packages/<p>/dist
//   (scripts/src-hash.mjs) tem de ser o do src atual. É conteúdo, não data:
//   salvar um arquivo sem mudar nada, trocar de branch e voltar ou rodar o
//   db:codegen com a mesma saída não recusam. O Metro lê o src
//   (apps/frontend/metro.config.js), então o web só checa as dependências.
//
// As mensagens só têm caminho e comando: nada de conteúdo de arquivo nem de
// variável de ambiente.
//
// Uso: node scripts/check-dev-env.mjs [--root <dir>] [--dist <pacote>...]
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readStamp, srcHash } from './src-hash.mjs'

const FIX = 'Rode: pnpm bootstrap'
export const USAGE =
  'Uso: node scripts/check-dev-env.mjs [--root <dir>] [--dist <pacote>...]'

/**
 * @param {string} root raiz do monorepo
 * @returns {string | null} o problema, ou null
 */
export function checkLockfile(root) {
  const installed = join(root, 'node_modules/.pnpm/lock.yaml')
  const wanted = join(root, 'pnpm-lock.yaml')
  if (
    !existsSync(installed) ||
    !existsSync(wanted) ||
    !readFileSync(installed).equals(readFileSync(wanted))
  ) {
    return `Dependências diferentes do pnpm-lock.yaml. ${FIX}`
  }
  return null
}

/**
 * @param {string} root raiz do monorepo
 * @param {string[]} packages pastas de packages/ cujo dist é lido
 * @returns {string[]} um problema por pacote
 */
export function checkDist(root, packages) {
  const problems = []
  for (const name of packages) {
    const dir = join(root, 'packages', name)
    if (!existsSync(join(dir, 'src'))) {
      problems.push(`packages/${name}/src não existe (pacote desconhecido?)`)
      continue
    }
    // Sem o carimbo (dist ausente ou de antes dele) também é build velho
    if (readStamp(dir) !== srcHash(dir)) {
      problems.push(
        `O build de @tms/${name} está mais velho que o código. ${FIX}`
      )
    }
  }
  return problems
}

/**
 * @param {string} root
 * @param {{ dist?: string[] }} [options]
 */
export function checkDevEnv(root, options = {}) {
  const lockfile = checkLockfile(root)
  return [
    ...(lockfile ? [lockfile] : []),
    ...checkDist(root, options.dist ?? []),
  ]
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  let root = join(import.meta.dirname, '..')
  const dist = []
  let mode = ''
  for (const arg of argv) {
    if (mode === '--root') {
      if (arg.startsWith('--')) throw new Error(`--root sem valor. ${USAGE}`)
      root = arg
      mode = ''
    } else if (arg === '--root' || arg === '--dist') mode = arg
    else if (mode === '--dist' && !arg.startsWith('--')) dist.push(arg)
    else throw new Error(`Argumento desconhecido: ${arg}. ${USAGE}`)
  }
  if (mode === '--root') throw new Error(`--root sem valor. ${USAGE}`)
  return { root, dist }
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(2)
  }
  const problems = checkDevEnv(args.root, { dist: args.dist })
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) process.exit(1)
}
