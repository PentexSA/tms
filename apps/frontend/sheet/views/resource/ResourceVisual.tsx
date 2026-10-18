import type { ResolvedResource } from '@tms/sheet-core'
import { BoxTrack, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'

// O desenho do recurso (design system: Resource): até 20, uma caixa por
// ponto; acima, um medidor. Só visual: quem fala é o describe() do core.
const MAX_BOXES = 20

export function ResourceVisual({
  r,
  compact = false,
}: {
  readonly r: ResolvedResource
  readonly compact?: boolean
}) {
  const { colors, accent } = useTheme()
  const max = r.shownMax
  if (max === null || max <= 0) return null
  if (max <= MAX_BOXES && !compact)
    return (
      <BoxTrack
        boxes={Array.from({ length: max }, (_, i) => ({
          tone: i < r.current ? ('severe' as const) : ('empty' as const),
        }))}
      />
    )
  const ratio = Math.max(0, Math.min(1, r.current / max))
  return (
    <View
      accessible={false}
      aria-hidden
      style={[
        compact ? styles.meterSmall : styles.meter,
        { backgroundColor: colors.borderSubtle },
      ]}
    >
      <View
        testID="resource-meter-fill"
        style={[
          styles.fill,
          { width: `${ratio * 100}%`, backgroundColor: accent.fill },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  meter: {
    height: tokens.space[2],
    borderRadius: tokens.radius.pill,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  meterSmall: {
    height: tokens.space[1],
    width: 48,
    borderRadius: tokens.radius.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
})
