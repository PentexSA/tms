import { createContext, type ReactNode, useContext, useMemo } from 'react'
import {
  type TextStyle,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import { tokens } from './tokens'

// Tema, skin e accent por contexto (design system §11). O @tms/ui não sabe
// nada de template: quem resolve "clã → accent-N" é o app, pelo core.

export type ThemeName = (typeof tokens.themes)[number]
export type ThemePreference = ThemeName | 'sistema'
export type SkinName = keyof typeof tokens.skins
export type Colors = Record<keyof (typeof tokens.color)['noite'], string>
export type ColorName = keyof Colors
export type TypeStyleName = keyof typeof tokens.type
export type Breakpoint = keyof typeof tokens.breakpoint

export interface AccentColors {
  readonly fill: string
  readonly text: string
  readonly on: string
}

export interface Theme {
  readonly name: ThemeName
  readonly colors: Colors
  readonly skin: SkinName
  readonly accent: AccentColors
  // Fontes do app carregadas (expo-font); sem elas, a fonte do sistema.
  readonly fonts: boolean
  readonly reduceMotion: boolean
}

interface ThemeSettings {
  readonly preference: ThemePreference
  readonly skin: SkinName
  readonly accent: string
  readonly fonts: boolean
  readonly reduceMotion: boolean
}

const DEFAULTS: ThemeSettings = {
  preference: 'sistema',
  skin: 'wod',
  accent: 'accent-neutral',
  fonts: false,
  reduceMotion: false,
}

const SettingsContext = createContext<ThemeSettings>(DEFAULTS)

export function accentColors(accent: string, theme: ThemeName): AccentColors {
  const palette = tokens.accents as Record<
    string,
    Record<ThemeName, AccentColors> | undefined
  >
  const found = Object.hasOwn(palette, accent) ? palette[accent] : undefined
  if (found) return found[theme]
  // accent-neutral (ou nome fora da paleta): fora da ficha e sem linhagem
  const c = tokens.color[theme]
  return { fill: c.accentNeutral, text: c.accentNeutral, on: c.onAccentNeutral }
}

export interface ThemeProviderProps extends Partial<ThemeSettings> {
  readonly children: ReactNode
}

/** Aninhável: um cartão de personagem troca só o accent, herdando o resto. */
export function ThemeProvider({
  children,
  preference,
  skin,
  accent,
  fonts,
  reduceMotion,
}: ThemeProviderProps) {
  const parent = useContext(SettingsContext)
  const settings = useMemo<ThemeSettings>(
    () => ({
      preference: preference ?? parent.preference,
      skin: skin ?? parent.skin,
      accent: accent ?? parent.accent,
      fonts: fonts ?? parent.fonts,
      reduceMotion: reduceMotion ?? parent.reduceMotion,
    }),
    [parent, preference, skin, accent, fonts, reduceMotion]
  )
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useTheme(): Theme {
  const s = useContext(SettingsContext)
  const scheme = useColorScheme()
  const name: ThemeName =
    s.preference === 'sistema'
      ? scheme === 'light'
        ? 'pergaminho'
        : 'noite'
      : s.preference
  return useMemo(
    () => ({
      name,
      colors: tokens.color[name],
      skin: s.skin,
      accent: accentColors(s.accent, name),
      fonts: s.fonts,
      reduceMotion: s.reduceMotion,
    }),
    [name, s.skin, s.accent, s.fonts, s.reduceMotion]
  )
}

// Família por peso: o Android não sintetiza o peso de fonte customizada.
function fontFamily(theme: Theme, variant: TypeStyleName): string | undefined {
  if (!theme.fonts) return undefined
  const style = tokens.type[variant]
  const italic = 'italic' in style && style.italic
  const key = `${style.fontWeight}${italic ? 'italic' : ''}`
  const skin = tokens.skins[theme.skin]
  const table: Record<string, string> =
    style.family === 'skin.display'
      ? skin.display
      : style.family === 'skin.voice'
        ? skin.voice
        : tokens.fonts.sans
  return table[key] ?? table[style.fontWeight] ?? tokens.fonts.sans['400']
}

export function textStyle(theme: Theme, variant: TypeStyleName): TextStyle {
  const style = tokens.type[variant]
  const family = fontFamily(theme, variant)
  return {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    // Com fonte própria o peso já está na família
    ...(family
      ? { fontFamily: family }
      : { fontWeight: style.fontWeight as TextStyle['fontWeight'] }),
    ...('letterSpacing' in style ? { letterSpacing: style.letterSpacing } : {}),
    ...('textTransform' in style
      ? { textTransform: style.textTransform as TextStyle['textTransform'] }
      : {}),
    ...('italic' in style && style.italic ? { fontStyle: 'italic' } : {}),
    ...('tabular' in style ? { fontVariant: ['tabular-nums'] } : {}),
  }
}

export function breakpointOf(width: number): Breakpoint {
  if (width >= tokens.breakpoint.expanded.min) return 'expanded'
  if (width >= tokens.breakpoint.medium.min) return 'medium'
  return 'compact'
}

/** Breakpoint e refluxo (DS §10): fonte ≥ 130% ou largura < 360 empilham. */
export function layoutOf(width: number, fontScale: number) {
  return {
    width,
    fontScale,
    breakpoint: breakpointOf(width),
    stacked: fontScale >= 1.3 || width < 360,
  }
}

export function useLayout() {
  const { width, fontScale } = useWindowDimensions()
  return layoutOf(width, fontScale)
}
