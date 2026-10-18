import type { ActionPlan } from '@tms/sheet-core'
import { Button, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'

// A prévia de uma ação do template (contrato §8): o que vai mudar, campo por
// campo, antes de aplicar. Aplicar é um lote só, com Desfazer no aviso.
export function ActionPreview({
  plan,
  onApply,
  onBack,
}: {
  readonly plan: Extract<ActionPlan, { ok: true }>
  readonly onApply: () => void
  readonly onBack: () => void
}) {
  return (
    <View style={styles.box}>
      <Text variant="fieldLabel" accessibilityRole="header" aria-level={3}>
        Prévia
      </Text>
      <View accessibilityRole="list" style={styles.list}>
        {plan.preview.map(p => (
          <Text key={p.label} accessibilityRole="text">
            {`${p.label}: ${p.change}`}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
        <Button title="Aplicar" onPress={onApply} />
        <Button title="Voltar" variant="ghost" onPress={onBack} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: tokens.space[3], paddingVertical: tokens.space[2] },
  list: { gap: tokens.space[1] },
  actions: { flexDirection: 'row', gap: tokens.space[3], flexWrap: 'wrap' },
})
