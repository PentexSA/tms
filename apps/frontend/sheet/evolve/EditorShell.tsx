import { Text, tokens, useTheme } from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

// A linha de um campo em Evoluir (DS: FieldRow com `editor`): rótulo à
// esquerda, controle à direita e, embaixo, o erro (do core ou do servidor).
export function EditorShell({
  label,
  sub,
  error,
  children,
  below,
  testID,
}: {
  readonly label: string
  readonly sub?: string | null
  readonly error?: string | null
  readonly children?: ReactNode
  readonly below?: ReactNode
  readonly testID?: string
}) {
  const { colors } = useTheme()
  return (
    <View
      testID={testID}
      style={[styles.wrap, { borderBottomColor: colors.borderSubtle }]}
    >
      <View style={styles.row}>
        <View style={styles.text}>
          <Text variant="fieldLabel">{label}</Text>
          {sub ? (
            <Text variant="caption" color="inkMuted" numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
      {below}
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: tokens.space[1],
    minHeight: tokens.size.rowMin,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  text: { flex: 1, gap: tokens.space['0.5'] },
})
