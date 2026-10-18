import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from './Text'
import { tokens } from './tokens'

export interface SectionHeaderProps {
  readonly title: string
  readonly subtitle?: string
  readonly right?: ReactNode
  // Título de seção (display da skin) ou de grupo (title).
  readonly level?: 'section' | 'group'
}

export function SectionHeader({
  title,
  subtitle,
  right,
  level = 'section',
}: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text
          variant={level === 'section' ? 'displayLg' : 'title'}
          accessibilityRole="header"
          aria-level={level === 'section' ? 2 : 3}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="inkMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    paddingVertical: tokens.space[2],
  },
  text: { flex: 1 },
})
