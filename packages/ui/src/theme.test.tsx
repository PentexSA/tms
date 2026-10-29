import { renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import * as RN from 'react-native'
import {
  accentColors,
  breakpointOf,
  layoutOf,
  ThemeProvider,
  textStyle,
  useLayout,
  useTheme,
} from './theme'
import { tokens } from './tokens'

const wrap =
  (props: Record<string, unknown>) =>
  ({ children }: { children: ReactNode }) => (
    <ThemeProvider {...props}>{children}</ThemeProvider>
  )

describe('tema', () => {
  it('"sistema" segue o esquema do aparelho', () => {
    const scheme = jest.spyOn(RN, 'useColorScheme')
    scheme.mockReturnValue('light')
    expect(renderHook(() => useTheme()).result.current.name).toBe('pergaminho')
    scheme.mockReturnValue('dark')
    expect(renderHook(() => useTheme()).result.current.name).toBe('noite')
    scheme.mockReturnValue(null)
    expect(renderHook(() => useTheme()).result.current.name).toBe('noite')
  })

  it('a preferência explícita vence o aparelho', () => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue('dark')
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrap({ preference: 'pergaminho' }),
    })
    expect(result.current.name).toBe('pergaminho')
    expect(result.current.colors.bg).toBe(tokens.color.pergaminho.bg)
  })

  it('provider aninhado troca só o que declara', () => {
    const Outer = wrap({ preference: 'noite', skin: 'dnd', fonts: true })
    const Inner = wrap({ accent: 'accent-1' })
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <Outer>
          <Inner>{children}</Inner>
        </Outer>
      ),
    })
    expect(result.current.skin).toBe('dnd')
    expect(result.current.fonts).toBe(true)
    expect(result.current.accent).toEqual(tokens.accents['accent-1'].noite)
  })

  it('accent fora da paleta cai no neutro', () => {
    expect(accentColors('accent-1', 'pergaminho')).toEqual(
      tokens.accents['accent-1'].pergaminho
    )
    expect(accentColors('#ff0000', 'noite')).toEqual({
      fill: tokens.color.noite.accentNeutral,
      text: tokens.color.noite.accentNeutral,
      on: tokens.color.noite.onAccentNeutral,
    })
  })
})

describe('tipografia', () => {
  const theme = (fonts: boolean, skin = 'wod') =>
    renderHook(() => useTheme(), { wrapper: wrap({ fonts, skin }) }).result
      .current

  it('sem as fontes do app: fonte do sistema com o peso', () => {
    expect(textStyle(theme(false), 'title')).toMatchObject({
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
    })
  })

  it('com as fontes: uma família por peso, sem fontWeight', () => {
    const s = textStyle(theme(true), 'title')
    expect(s.fontFamily).toBe(tokens.fonts.sans['700'])
    expect(s.fontWeight).toBeUndefined()
  })

  it('display e voz vêm da skin', () => {
    expect(textStyle(theme(true, 'wod'), 'displayLg').fontFamily).toBe(
      tokens.skins.wod.display['600']
    )
    const voice = textStyle(theme(true, 'wod'), 'voice')
    expect(voice.fontFamily).toBe(tokens.skins.wod.voice['600italic'])
    expect(voice.fontStyle).toBe('italic')
  })

  it('números tabulares e rótulo em caixa alta', () => {
    expect(textStyle(theme(false), 'number').fontVariant).toEqual([
      'tabular-nums',
    ])
    expect(textStyle(theme(false), 'label')).toMatchObject({
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    })
  })
})

describe('layout', () => {
  it.each([
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [899, 'medium'],
    [900, 'expanded'],
  ] as const)('%i dp → %s', (w, b) => {
    expect(breakpointOf(w)).toBe(b)
  })

  it.each([
    [390, 1, false],
    [390, 1.3, true],
    [359, 1, true],
  ])('largura %i, fonte %p → empilha: %p', (width, fontScale, stacked) => {
    expect(layoutOf(width, fontScale).stacked).toBe(stacked)
  })

  it('useLayout lê a janela', () => {
    const { result } = renderHook(() => useLayout())
    expect(result.current.breakpoint).toBe(breakpointOf(result.current.width))
  })
})
