// T-01 (D-00): todo módulo nativo instalado fica na faixa que o SDK do Expo
// testou. O `expo install --check` só olha as dependências diretas do app; um
// transitivo nativo (o react-native-gesture-handler 2.28.0 que o
// react-native-drawer-layout do expo-router puxava) passa por ele e só quebra
// no build nativo. Este script compara cada pacote de
// node_modules/expo/bundledNativeModules.json que estiver instalado (na raiz,
// hoisted, ou no node_modules do app) com a faixa do SDK.
//
// As faixas do arquivo têm três formas: ~x.y.z, ^x.y.z e x.y.z. Outra forma
// falha (melhor parar que aprovar sem saber comparar).
//
// Uso: node scripts/check-native-versions.mjs [--root <dir>]
import { existsSync, readFileSync } from 'node:fs'
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
  // ^0.y.z trava o minor, como no semver
  if (wanted.major === 0) return have.minor === wanted.minor && atLeast
  return atLeast
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
  const places = ['node_modules', 'apps/frontend/node_modules']
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
        problems.push(
          `${name} ${installed} instalado (${place}); o SDK espera ${range}. Rode: pnpm -C apps/frontend exec expo install ${name}`
        )
      }
    }
  }
  return problems
}

if (import.meta.main ?? process.argv[1] === import.meta.filename) {
  const flag = process.argv.indexOf('--root')
  const root =
    flag === -1 ? join(import.meta.dirname, '..') : process.argv[flag + 1]
  const problems = checkNativeVersions(root)
  for (const problem of problems) console.error(problem)
  if (problems.length > 0) process.exit(1)
  console.log('Módulos nativos na faixa do SDK do Expo.')
}
