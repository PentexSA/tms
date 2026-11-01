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
  for (const [name, version] of Object.entries(installed)) {
    mkdirSync(join(root, 'node_modules', name), { recursive: true })
    writeFileSync(
      join(root, 'node_modules', name, 'package.json'),
      JSON.stringify({ name, version })
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

  it('sem o expo instalado, manda instalar', () => {
    const root = mkdtempSync(join(tmpdir(), 'tms-native-'))
    roots.push(root)
    expect(checkNativeVersions(root)).toEqual([
      'node_modules/expo/bundledNativeModules.json não encontrado. Rode: pnpm install',
    ])
  })
})
