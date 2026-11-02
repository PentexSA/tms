import { Text, tokens, useTheme } from '@tms/ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

// A linha de um campo em Evoluir (DS: FieldRow com `editor`): rótulo à
// esquerda, controle à direita. O erro (do core, da conta ou do servidor) fica
// na coluna do rótulo, logo abaixo dele, na altura do toque (T-20): embaixo
// de tudo, ele caía fora da tela a 390 px. A linha cresce para baixo.
export function EditorShell({
  label,
  sub,
  note,
  error,
  children,
  below,
  testID,
}: {
  readonly label: string
  readonly sub?: string | null
  // Nota da linha sob o rótulo (o custo do próximo ponto na criação)
  readonly note?: ReactNode
  // Texto (vira alerta) ou o aviso já montado (DraftNoticeText)
  readonly error?: ReactNode
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
        <View
          style={styles.text}
          testID={testID ? `${testID}-label` : undefined}
        >
          <Text variant="fieldLabel">{label}</Text>
          {sub ? (
            <Text variant="caption" color="inkMuted" numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
          {note || null}
          {typeof error === 'string' && error ? (
            <Text variant="caption" color="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : (
            error || null
          )}
        </View>
        {children}
      </View>
      {below}
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
