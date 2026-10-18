import { jsonEqual, parsePath } from '@tms/sheet-core'
import { Banner, Button, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector, useSheetStore } from './context'

// O 409 (doc/arquitetura §6.6): alguém mudou o campo antes de o lote chegar.
// A ficha já foi rebuscada; a pessoa decide se reaplica por cima.
export function ConflictBanner() {
  const { model } = useSheet()
  const store = useSheetStore()
  const paths = useSheetSelector(s => s.conflict?.paths ?? null, jsonEqual)
  if (!paths) return null
  const labels = [
    ...new Set(
      paths.map(p => {
        const parsed = parsePath(p)
        const label = parsed
          ? (model.fields.get(parsed.fieldId)?.def.label ?? parsed.fieldId)
          : p
        return parsed?.scope === 'specialties'
          ? `${label} (especialização)`
          : label
      })
    ),
  ]
  return (
    <View style={styles.wrap}>
      <Banner
        tone="warning"
        title="A ficha mudou em outro lugar"
        message={`${labels.join(', ')} mudou antes de a sua alteração chegar. A ficha mostra o valor de agora.`}
        action={
          <View style={styles.actions}>
            <Button
              title="Reaplicar"
              variant="secondary"
              onPress={() => store.getState().reapply()}
            />
            <Button
              title="Manter como está"
              variant="ghost"
              onPress={() => store.getState().dismissConflict()}
            />
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[3],
  },
  actions: { flexDirection: 'row', gap: tokens.space[2], flexWrap: 'wrap' },
})
