// S-01 e S-02: a API e o web se recusam a subir com dependências ou build
// desatualizados, e dizem o comando que resolve. Só checa; não instala nem
// compila nada.
//
// - Dependências (S-02): o lockfile que o pnpm grava do que instalou
//   (node_modules/.pnpm/lock.yaml, também com nodeLinker: hoisted) tem de ser
//   igual ao pnpm-lock.yaml.
// - Build (S-01, só para quem lê o dist: a API, as migrations e os scripts no
//   Bun): com --dist, o arquivo mais novo de packages/<p>/src (sem testes)
//   não pode ser mais novo que o arquivo mais novo de packages/<p>/dist. O
//   Metro lê o src (apps/frontend/metro.config.js), então o web só checa as
//   dependências.
//
// Comparar por data pode pedir um bootstrap à toa (arquivo tocado sem
// mudar); o bootstrap resolve, porque o turbo restaura o dist do cache.
// As mensagens só têm caminho e comando: nada de conteúdo de arquivo nem de
// variável de ambiente.
//
// Uso: node scripts/check-dev-env.mjs [--root <dir>] [--dist <pacote>...]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FIX = 'Rode: pnpm bootstrap'

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
 * O arquivo mais novo da pasta (em ms), sem testes. 0 se não houver nenhum.
 * @param {string} dir
 * @param {boolean} skipTests
 */
function newest(dir, skipTests) {
  let latest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (skipTests && entry.name === '__tests__') continue
      latest = Math.max(latest, newest(path, skipTests))
    } else if (!(skipTests && /\.test\.[cm]?[jt]sx?$/.test(entry.name))) {
      latest = Math.max(latest, statSync(path).mtimeMs)
    }
  }
  return latest
}

/**
 * @param {string} root raiz do monorepo
 * @param {string[]} packages pastas de packages/ cujo dist é lido
 * @returns {string[]} um problema por pacote
 */
export function checkDist(root, packages) {
  const problems = []
  for (const name of packages) {
    const src = join(root, 'packages', name, 'src')
    const dist = join(root, 'packages', name, 'dist')
    if (!existsSync(src)) {
      problems.push(`packages/${name}/src não existe (pacote desconhecido?)`)
      continue
    }
    if (!existsSync(dist) || newest(src, true) > newest(dist, false)) {
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
    if (arg === '--root' || arg === '--dist') mode = arg
    else if (mode === '--root') {
      root = arg
      mode = ''
    } else if (mode === '--dist') dist.push(arg)
    else throw new Error(`Argumento desconhecido: ${arg}`)
  }
  return { root, dist }
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const { root, dist } = parseArgs(process.argv.slice(2))
  const problems = checkDevEnv(root, { dist })
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) process.exit(1)
}
