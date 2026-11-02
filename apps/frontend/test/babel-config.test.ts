/**
 * @jest-environment node
 */
// S-01: o @tms/ui vem do src, mas compila com o JSX do React, como o dist.
// Com o JSX do NativeWind, o Pressable dele perdia o style em função no
// nativo (botões sem fundo, alvo sem 48 dp), e só o aparelho mostrava.
import path from 'node:path'
import { loadPartialConfig, transformSync } from '@babel/core'

const frontend = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(frontend, '../..')

// Como o Metro chama o babel (o preset do Expo lê platform e bundler)
const caller = { name: 'metro', bundler: 'metro', platform: 'android' }

function compile(filename: string): string {
  const out = transformSync('export const A = () => <View />', {
    filename,
    cwd: frontend,
    root: frontend,
    configFile: path.join(frontend, 'babel.config.js'),
    babelrc: false,
    caller,
  })
  return out?.code ?? ''
}

describe('babel.config.js', () => {
  it('compila o src do @tms/ui com o JSX do React, sem o do NativeWind', () => {
    const code = compile(
      path.join(workspaceRoot, 'packages/ui/src/Pressable.tsx')
    )
    expect(code).toContain('react/jsx-runtime')
    expect(code).not.toContain('react-native-css-interop')
    expect(code).not.toContain('nativewind')
  })

  it('carrega sem nome de arquivo, como na chave de cache do Metro', () => {
    expect(() =>
      loadPartialConfig({
        cwd: frontend,
        root: frontend,
        configFile: path.join(frontend, 'babel.config.js'),
        babelrc: false,
      })
    ).not.toThrow()
  })

  it('o código do app continua com o JSX do NativeWind', () => {
    const code = compile(path.join(frontend, 'components/Probe.tsx'))
    expect(code).toMatch(/react-native-css-interop|nativewind/)
  })
})
