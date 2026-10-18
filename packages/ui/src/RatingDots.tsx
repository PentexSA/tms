import { View } from 'react-native'
import Svg, { Circle, G, Line, Rect } from 'react-native-svg'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Pips (design system: RatingDots). Só visual: o número está sempre ao lado e
// a frase acessível vem do describe() do core, por isso ficam fora da árvore
// de acessibilidade. Forma do pip vem da skin (circle, diamond, square).

export type PipKind = 'on' | 'off' | 'bonus' | 'lost'
export type PipShape = 'circle' | 'diamond' | 'square'

export interface PipSegment {
  readonly kind: PipKind
  readonly n: number
}

export interface RatingDotsProps {
  // Ou o valor simples (on até value, off até max), ou segmentos prontos.
  readonly value?: number
  readonly max?: number
  readonly segments?: readonly PipSegment[]
  readonly shape?: PipShape
  readonly size?: 'md' | 'sm'
  readonly testID?: string
}

export function pipsOf(props: RatingDotsProps): PipKind[] {
  if (props.segments)
    return props.segments.flatMap(s =>
      Array.from({ length: Math.max(0, s.n) }, () => s.kind)
    )
  const max = props.max ?? 5
  const value = Math.max(0, Math.min(props.value ?? 0, max))
  return Array.from({ length: max }, (_, i) => (i < value ? 'on' : 'off'))
}

export function RatingDots(props: RatingDotsProps) {
  const theme = useTheme()
  const pips = pipsOf(props)
  const d = props.size === 'sm' ? tokens.size.pipSizeSm : tokens.size.pipSize
  const gap = tokens.space[1]
  const stroke = tokens.borderWidth.control
  const fill = theme.accent.fill
  const empty = theme.colors.pipEmpty
  const shape = props.shape ?? tokens.skins[theme.skin].pip
  return (
    <View testID={props.testID} accessible={false} aria-hidden>
      <Svg width={pips.length * (d + gap) - gap} height={d}>
        {pips.map((kind, i) => {
          const x = i * (d + gap)
          const r = (d - stroke) / 2
          const color = kind === 'off' ? empty : fill
          const solid = kind === 'on'
          const common = {
            stroke: color,
            strokeWidth: stroke,
            fill: solid ? color : 'none',
          }
          const cx = x + d / 2
          const cy = d / 2
          // O losango é um quadrado girado: o lado cabe na diagonal do pip
          const side =
            shape === 'diamond' ? (d - stroke) / Math.SQRT2 : d - stroke
          const body =
            shape === 'circle' ? (
              <Circle cx={cx} cy={cy} r={r} {...common} />
            ) : (
              <Rect
                x={cx - side / 2}
                y={cy - side / 2}
                width={side}
                height={side}
                rx={shape === 'square' ? 2 : 0}
                transform={
                  shape === 'diamond' ? `rotate(45 ${cx} ${cy})` : undefined
                }
                {...common}
              />
            )
          return (
            <G key={i} testID={`pip-${kind}`}>
              {body}
              {/* bônus: anel duplo; perdido: traço diagonal (nunca só cor) */}
              {kind === 'bonus' ? (
                <Circle
                  cx={cx}
                  cy={cy}
                  r={r / 2}
                  stroke={color}
                  strokeWidth={stroke}
                  fill="none"
                />
              ) : null}
              {kind === 'lost' ? (
                <Line
                  x1={x + stroke}
                  y1={d - stroke}
                  x2={x + d - stroke}
                  y2={stroke}
                  stroke={color}
                  strokeWidth={stroke}
                />
              ) : null}
            </G>
          )
        })}
      </Svg>
    </View>
  )
}
