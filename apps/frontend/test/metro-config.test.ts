/**
 * @jest-environment node
 */
// S-01: o Metro resolve os pacotes do monorepo pelo src, como o Jest. Sem
// isso, o web e os bundles nativos rodavam o dist compilado à mão (o de
// 18/10 abria "Atualize o app" com o template de schema novo).
import path from 'node:path'

type Resolution = { type: string; filePath?: string }
type Resolver = (
  context: { resolveRequest: Resolver },
  name: string,
  platform: string | null
) => Resolution

const workspaceRoot = path.resolve(__dirname, '../../..')

function loadResolver(): Resolver {
  // O config é CommonJS de Node; o withNativeWind embrulha o resolver dele
  const config = require('../metro.config.js') as {
    resolver: { resolveRequest: Resolver }
  }
  return config.resolver.resolveRequest
}

describe('metro.config.js', () => {
  // Função comum, não jest.fn: o preset reseta as implementações dos mocks
  const fallbackCalls: string[] = []
  const fallback: Resolver = (_context, name) => {
    fallbackCalls.push(name)
    return { type: 'sourceFile', filePath: `/node_modules/${name}/index.js` }
  }
  const context = { resolveRequest: fallback }

  it.each([
    ['@tms/sheet-core', 'packages/sheet-core/src/index.ts'],
    ['@tms/ui', 'packages/ui/src/index.ts'],
  ])('%s vem do src em todas as plataformas', (name, file) => {
    const resolve = loadResolver()
    for (const platform of ['web', 'ios', 'android', null]) {
      expect(resolve(context, name, platform)).toEqual({
        type: 'sourceFile',
        filePath: path.join(workspaceRoot, file),
      })
    }
    expect(fallbackCalls).toEqual([])
  })

  it('o resto segue o resolver padrão', () => {
    const resolve = loadResolver()
    expect(resolve(context, 'react-native', 'ios')).toEqual({
      type: 'sourceFile',
      filePath: '/node_modules/react-native/index.js',
    })
    // Subcaminho não é a entrada do pacote: não é desviado
    expect(resolve(context, '@tms/ui/package.json', 'web').filePath).toBe(
      '/node_modules/@tms/ui/package.json/index.js'
    )
  })

  it('os mesmos pacotes vêm do src no Jest', () => {
    const jestConfig = require('../jest.config.js') as {
      moduleNameMapper: Record<string, string>
    }
    expect(jestConfig.moduleNameMapper['^@tms/sheet-core$']).toBe(
      '<rootDir>/../../packages/sheet-core/src'
    )
    expect(jestConfig.moduleNameMapper['^@tms/ui$']).toBe(
      '<rootDir>/../../packages/ui/src'
    )
  })
})
