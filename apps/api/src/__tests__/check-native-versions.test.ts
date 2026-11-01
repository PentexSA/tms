/// <reference types="bun-types" />
// T-01 (D-00): a checagem do CI pega um módulo nativo transitivo fora da
// faixa do SDK do Expo. O script é da raiz (scripts/), sem dependência; fica
// testado aqui porque a API já roda Bun.
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  checkNativeVersions,
  parseArgs,
  satisfies,
} from '../../../../scripts/check-native-versions.mjs'

const roots: string[] = []

function fakeRoot(
  ranges: Record<string, string>,
  installed: Record<string, string>
) {
  const root = mkdtempSync(join(tmpdir(), 'tms-native-'))
  roots.push(root)
  mkdirSync(join(root, 'node_modules/expo'), { recursive: true })
  writeFileSync(
    join(root, 'node_modules/expo/bundledNativeModules.json'),
    JSON.stringify(ranges)
  )
  for (const [path, version] of Object.entries(installed)) {
    // Caminho de apps/ fica onde está; o resto vai para o node_modules da raiz
    const dir = path.startsWith('apps/')
      ? join(root, path)
      : join(root, 'node_modules', path)
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: path.split('/').pop(), version })
    )
  }
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true })
})

describe('satisfies', () => {
  it('~x.y.z trava major e minor', () => {
    expect(satisfies('3.3.0', '~3.3.0')).toBe(true)
    expect(satisfies('3.3.4', '~3.3.0')).toBe(true)
    expect(satisfies('3.4.0', '~3.3.0')).toBe(false)
    expect(satisfies('3.2.9', '~3.3.0')).toBe(false)
    expect(satisfies('2.28.0', '~3.3.0')).toBe(false)
  })

  it('^x.y.z trava o major (e o minor no 0.x)', () => {
    expect(satisfies('1.9.0', '^1.2.0')).toBe(true)
    expect(satisfies('1.1.9', '^1.2.0')).toBe(false)
    expect(satisfies('2.0.0', '^1.2.0')).toBe(false)
    expect(satisfies('0.13.5', '^0.13.0')).toBe(true)
    expect(satisfies('0.14.0', '^0.13.0')).toBe(false)
  })

  it('^0.0.z trava o patch exato, como no semver', () => {
    expect(satisfies('0.0.3', '^0.0.3')).toBe(true)
    expect(satisfies('0.0.4', '^0.0.3')).toBe(false)
    expect(satisfies('0.0.2', '^0.0.3')).toBe(false)
    expect(satisfies('0.1.3', '^0.0.3')).toBe(false)
  })

  it('x.y.z e pré-release só valem idênticas', () => {
    expect(satisfies('0.88.0', '0.88.0')).toBe(true)
    expect(satisfies('0.88.1', '0.88.0')).toBe(false)
    expect(satisfies('3.3.0-beta.1', '~3.3.0')).toBe(false)
  })

  it('faixa de forma desconhecida não é aprovada', () => {
    expect(satisfies('1.0.0', '>=1.0.0')).toBeNull()
    expect(satisfies('1.0.0', '*')).toBeNull()
  })
})

describe('checkNativeVersions', () => {
  it('acusa o gesture-handler 2.28.0 contra o ~3.3.0 do SDK 58', () => {
    const root = fakeRoot(
      {
        'react-native-gesture-handler': '~3.3.0',
        'react-native-reanimated': '4.7.1',
        'expo-camera': '~58.0.0',
      },
      {
        'react-native-gesture-handler': '2.28.0',
        'react-native-reanimated': '4.7.1',
      }
    )
    expect(checkNativeVersions(root)).toEqual([
      'react-native-gesture-handler 2.28.0 instalado (node_modules); o SDK espera ~3.3.0. Rode: pnpm -C apps/frontend exec expo install react-native-gesture-handler',
    ])
  })

  it('passa com tudo na faixa e ignora o que não está instalado', () => {
    const root = fakeRoot(
      { 'react-native-gesture-handler': '~3.3.0', 'expo-camera': '~58.0.0' },
      { 'react-native-gesture-handler': '3.3.0' }
    )
    expect(checkNativeVersions(root)).toEqual([])
  })

  it('acusa a cópia aninhada que o linker hoisted esconde (o caso do T-01)', () => {
    const root = fakeRoot(
      { 'react-native-gesture-handler': '~3.3.0', 'expo-camera': '~58.0.0' },
      {
        'react-native-gesture-handler': '3.3.0',
        'react-native-drawer-layout/node_modules/react-native-gesture-handler':
          '2.28.0',
        '@scope/tool/node_modules/expo-camera': '57.0.1',
        'apps/frontend/node_modules/x/node_modules/expo-camera': '58.0.2',
      }
    )
    expect(checkNativeVersions(root)).toEqual([
      'react-native-gesture-handler 2.28.0 instalado (node_modules/react-native-drawer-layout/node_modules); o SDK espera ~3.3.0. Rode: pnpm -C apps/frontend exec expo install react-native-gesture-handler e confira quem pede outra versão (pnpm why react-native-gesture-handler)',
      'expo-camera 57.0.1 instalado (node_modules/@scope/tool/node_modules); o SDK espera ~58.0.0. Rode: pnpm -C apps/frontend exec expo install expo-camera e confira quem pede outra versão (pnpm why expo-camera)',
    ])
  })

  it('sem o expo instalado, manda instalar', () => {
    const root = mkdtempSync(join(tmpdir(), 'tms-native-'))
    roots.push(root)
    expect(checkNativeVersions(root)).toEqual([
      'node_modules/expo/bundledNativeModules.json não encontrado. Rode: pnpm install',
    ])
  })
})

describe('argumentos', () => {
  it('--root com valor', () => {
    expect(parseArgs(['--root', '/r'])).toEqual({ root: '/r' })
  })

  it('--root sem valor e argumento desconhecido são erro de uso', () => {
    expect(() => parseArgs(['--root'])).toThrow('--root sem valor. Uso:')
    expect(() => parseArgs(['--root', '--x'])).toThrow('--root sem valor')
    expect(() => parseArgs(['--fix'])).toThrow('Argumento desconhecido')
  })
})
