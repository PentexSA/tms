import { useId } from 'react'
import { View } from 'react-native'
import Svg, { Defs, G, Line, Path, Pattern } from 'react-native-svg'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Roda de N casas com até dois preenchimentos opostos (design system: Clock).
// Quintessência e Paradoxo do Mago; relógios de PbtA com um preenchimento.
// O preenchimento do início enche no sentido horário a partir do topo; o do
// fim, no sentido anti-horário. Os tons alternativos são sempre hachurados,
// para nunca depender só da cor. Os números ficam fora do miolo, com quem usa.

export type ClockTone = 'accent' | 'alt-cool' | 'alt-warm' | 'neutral'

export interface ClockFill {
  readonly id: string
  readonly n: number
  readonly from: 'start' | 'end'
  readonly tone: ClockTone
}

export interface ClockProps {
  // 2 a 24 casas (contrato: clock.segments).
  readonly segments: number
  readonly fills: readonly ClockFill[]
  readonly size?: number
  // Com rótulo, a roda é uma imagem acessível; sem, fica fora da árvore (o
  // sheet anuncia pelos Steppers).
  readonly accessibilityLabel?: string
  readonly testID?: string
}

export interface ClockSegment {
  // Id do preenchimento da casa; null quando está livre.
  readonly fill: string | null
  readonly tone: ClockTone | null
}

export const CLOCK_MIN_SEGMENTS = 2
export const CLOCK_MAX_SEGMENTS = 24

/** As casas em ordem horária a partir do topo, com o dono de cada uma. */
export function clockSegmentsOf(
  props: Pick<ClockProps, 'segments' | 'fills'>
): ClockSegment[] {
  const n = Math.max(
    CLOCK_MIN_SEGMENTS,
    Math.min(CLOCK_MAX_SEGMENTS, Math.floor(props.segments))
  )
  const out: ClockSegment[] = Array.from({ length: n }, () => ({
    fill: null,
    tone: null,
  }))
  let start = 0
  let end = n - 1
  for (const f of props.fills) {
    for (let i = 0; i < Math.max(0, Math.floor(f.n)) && start <= end; i++) {
      const at = f.from === 'start' ? start++ : end--
      out[at] = { fill: f.id, tone: f.tone }
    }
  }
  return out
}

// Ponto do arco em graus, 0 no topo, sentido horário.
const polar = (c: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return `${(c + r * Math.cos(rad)).toFixed(2)} ${(c + r * Math.sin(rad)).toFixed(2)}`
}

function sectorPath(
  c: number,
  outer: number,
  inner: number,
  a0: number,
  a1: number
) {
  const large = a1 - a0 > 180 ? 1 : 0
  return [
    `M ${polar(c, outer, a0)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${polar(c, outer, a1)}`,
    `L ${polar(c, inner, a1)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${polar(c, inner, a0)}`,
    'Z',
  ].join(' ')
}

export function Clock(props: ClockProps) {
  const { colors, accent } = useTheme()
  const hatch = useId().replace(/[^a-zA-Z0-9]/g, '')
  const size = props.size ?? tokens.size.hitSize * 3
  const segments = clockSegmentsOf(props)
  const stroke = tokens.borderWidth.control
  const c = size / 2
  const outer = c - stroke
  const inner = outer * 0.62
  // Intervalo de ~3,5° entre casas (design system)
  const gap = Math.min(3.5, 360 / segments.length / 3)
  const step = 360 / segments.length
  const colorOf = (tone: ClockTone) =>
    tone === 'accent'
      ? accent.fill
      : tone === 'alt-cool'
        ? colors.accentAltCool
        : tone === 'alt-warm'
          ? colors.accentAltWarm
          : colors.accentNeutral
  const tones = [
    ...new Set(
      segments.flatMap(s => (s.tone && s.tone !== 'accent' ? [s.tone] : []))
    ),
  ]
  const label = props.accessibilityLabel
  return (
    <View
      testID={props.testID}
      {...(label
        ? {
            accessible: true,
            accessibilityRole: 'image' as const,
            accessibilityLabel: label,
          }
        : { accessible: false, 'aria-hidden': true })}
    >
      <Svg width={size} height={size}>
        <Defs>
          {tones.map(tone => (
            <Pattern
              key={tone}
              id={`${hatch}-${tone}`}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <Line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke={colorOf(tone)}
                strokeWidth={3}
              />
            </Pattern>
          ))}
        </Defs>
        {segments.map((s, i) => {
          const d = sectorPath(
            c,
            outer,
            inner,
            i * step + gap / 2,
            (i + 1) * step - gap / 2
          )
          const color = s.tone ? colorOf(s.tone) : colors.borderControl
          const fill = !s.tone
            ? 'none'
            : s.tone === 'accent'
              ? color
              : `url(#${hatch}-${s.tone})`
          return (
            <G key={i} testID={`clock-${s.fill ?? 'free'}`}>
              <Path d={d} fill={fill} stroke={color} strokeWidth={stroke} />
            </G>
          )
        })}
      </Svg>
    </View>
  )
}
