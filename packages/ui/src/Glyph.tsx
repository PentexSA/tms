import Svg, { Circle, Path } from 'react-native-svg'

// Glifos da skin (design system: AugurMoon), desenhados a partir de um número
// do template (`glyph` no campo, `glyphParam` na opção). Decorativos: o
// rótulo da opção está ao lado. Um nome desconhecido não desenha nada.

const C = 12
const R = 9

// Fase da lua, de 0 (nova) a 1 (cheia): a parte iluminada fica à direita, e o
// terminador é meia elipse de raio horizontal R·|1 − 2p|.
export function moonPath(phase: number): string | null {
  const p = Math.min(1, Math.max(0, phase))
  if (p === 0) return null
  if (p === 1)
    return `M${C} ${C - R} A${R} ${R} 0 1 1 ${C} ${C + R} A${R} ${R} 0 1 1 ${C} ${C - R} Z`
  const rx = (R * Math.abs(1 - 2 * p)).toFixed(2)
  // De baixo para cima: pela direita (crescente) ou pela esquerda (gibosa)
  const sweep = p > 0.5 ? 1 : 0
  return `M${C} ${C - R} A${R} ${R} 0 0 1 ${C} ${C + R} A${rx} ${R} 0 0 ${sweep} ${C} ${C - R} Z`
}

const GLYPHS = {
  'augur-moon': (param: number, color: string) => {
    const lit = moonPath(param)
    return (
      <>
        <Circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
        />
        {lit ? <Path d={lit} fill={color} /> : null}
      </>
    )
  },
} as const

export type GlyphName = keyof typeof GLYPHS

export const isGlyph = (name: unknown): name is GlyphName =>
  typeof name === 'string' && Object.hasOwn(GLYPHS, name)

export interface GlyphProps {
  readonly name: GlyphName
  // 0 a 1 (a fase da lua)
  readonly param: number
  readonly size?: number
  readonly color: string
  readonly testID?: string
}

/** Decorativo: o texto da opção está ao lado. */
export function Glyph({ name, param, size = 20, color, testID }: GlyphProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      testID={testID}
      aria-hidden
    >
      {GLYPHS[name](param, color)}
    </Svg>
  )
}
