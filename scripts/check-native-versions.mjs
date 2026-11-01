// T-01 (D-00): todo módulo nativo instalado fica na faixa que o SDK do Expo
// testou. O `expo install --check` só olha as dependências diretas do app; um
// transitivo nativo (o react-native-gesture-handler 2.28.0 que o
// react-native-drawer-layout do expo-router puxava) passa por ele e só quebra
// no build nativo. Este script compara cada pacote de
// node_modules/expo/bundledNativeModules.json que estiver instalado com a
// faixa do SDK: na raiz (hoisted), no node_modules do app e nos node_modules
// aninhados, onde o linker hoisted põe a versão conflitante de um transitivo
// (o caso do T-01: node_modules/<quem depende>/node_modules/<nativo>).
//
// As faixas do arquivo têm três formas: ~x.y.z, ^x.y.z e x.y.z. Outra forma
// falha (melhor parar que aprovar sem saber comparar).
//
// Uso: node scripts/check-native-versions.mjs [--root <dir>]
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

/** @param {string} version */
function parse(version) {
  const match = VERSION.exec(version)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ?? null,
  }
}

/**
 * A versão instalada satisfaz a faixa do SDK? `null` quando a faixa não tem
 * uma das três formas conhecidas.
 * @param {string} installed
 * @param {string} range
 * @returns {boolean | null}
 */
export function satisfies(installed, range) {
  const operator = range[0] === '~' || range[0] === '^' ? range[0] : ''
  const wanted = parse(range.slice(operator.length))
  const have = parse(installed)
  if (!wanted) return null
  if (!have) return false
  // Pré-release só vale idêntica: a faixa do SDK é de versões publicadas
  if (have.pre !== null || wanted.pre !== null || operator === '') {
    return installed === range.slice(operator.length)
  }
  if (have.major !== wanted.major) return false
  const atLeast =
    have.minor > wanted.minor ||
    (have.minor === wanted.minor && have.patch >= wanted.patch)
  if (operator === '~') return have.minor === wanted.minor && atLeast
  // Como no semver: ^0.0.z trava o patch, ^0.y.z trava o minor
  if (wanted.major === 0 && wanted.minor === 0)
    return have.minor === 0 && have.patch === wanted.patch
  if (wanted.major === 0) return have.minor === wanted.minor && atLeast
  return atLeast
}

export const USAGE =
  'Uso: node scripts/check-native-versions.mjs [--root <dir>]'

/** @param {string[]} argv */
export function parseArgs(argv) {
  let root = join(import.meta.dirname, '..')
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg !== '--root')
      throw new Error(`Argumento desconhecido: ${arg}. ${USAGE}`)
    const value = argv[++i]
    if (value === undefined || value.startsWith('--'))
      throw new Error(`--root sem valor. ${USAGE}`)
    root = value
  }
  return { root }
}

/**
 * As pastas node_modules a conferir (relativas à raiz): as de cima e todas
 * as aninhadas dentro dos pacotes delas. Links simbólicos (pacotes do
 * workspace) não são seguidos.
 * @param {string} root
 */
export function nodeModulesDirs(root) {
  /** @type {string[]} */
  const found = []
  /** @param {string} dir */
  const visit = dir => {
    if (!existsSync(join(root, dir))) return
    found.push(dir)
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const packages = entry.name.startsWith('@')
        ? readdirSync(join(root, dir, entry.name), { withFileTypes: true })
            .filter(scoped => scoped.isDirectory())
            .map(scoped => `${entry.name}/${scoped.name}`)
        : [entry.name]
      for (const pkg of packages) visit(`${dir}/${pkg}/node_modules`)
    }
  }
  visit('node_modules')
  visit('apps/frontend/node_modules')
  return found
}

/** @param {string} file */
function readVersion(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8')).version ?? null
  } catch {
    return null
  }
}

/**
 * Lista os pacotes nativos fora da faixa do SDK.
 * @param {string} root raiz do monorepo
 * @returns {string[]} uma mensagem por pacote
 */
export function checkNativeVersions(root) {
  const bundled = join(root, 'node_modules/expo/bundledNativeModules.json')
  if (!existsSync(bundled)) {
    return [
      'node_modules/expo/bundledNativeModules.json não encontrado. Rode: pnpm install',
    ]
  }
  /** @type {Record<string, string>} */
  const ranges = JSON.parse(readFileSync(bundled, 'utf8'))
  const places = nodeModulesDirs(root)
  const problems = []
  for (const [name, range] of Object.entries(ranges)) {
    for (const place of places) {
      const installed = readVersion(join(root, place, name, 'package.json'))
      if (installed === null) continue
      const ok = satisfies(installed, range)
      if (ok === null) {
        problems.push(
          `${name}: faixa "${range}" do SDK com forma desconhecida; atualize scripts/check-native-versions.mjs`
        )
      } else if (!ok) {
        const fix = `pnpm -C apps/frontend exec expo install ${name}`
        problems.push(
          place === 'node_modules' || place === 'apps/frontend/node_modules'
            ? `${name} ${installed} instalado (${place}); o SDK espera ${range}. Rode: ${fix}`
            : `${name} ${installed} instalado (${place}); o SDK espera ${range}. Rode: ${fix} e confira quem pede outra versão (pnpm why ${name})`
        )
      }
    }
  }
  return problems
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  let root
  try {
    root = parseArgs(process.argv.slice(2)).root
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(2)
  }
  const problems = checkNativeVersions(root)
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) process.exit(1)
  console.log('Módulos nativos na faixa do SDK do Expo.')
}
