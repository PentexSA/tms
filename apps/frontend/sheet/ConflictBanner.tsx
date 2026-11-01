import { jsonEqual } from '@tms/sheet-core'
import { Banner, Button, tokens } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ConflictSheet, changedByText, conflictLabel } from './ConflictSheet'
import { useSheet, useSheetSelector } from './context'
import type { SheetConflict } from './store/sheetStore'

// O 409 (doc/arquitetura §6.6; T-31): alguém mudou um campo antes de o lote
// chegar. A faixa nomeia só os campos em conflito e leva a "Revisar", onde a
// pessoa vê o seu valor e o de agora antes de escolher. Ninguém reaplica sem
// ver o valor da outra pessoa.

const names = (labels: readonly string[]) =>
  labels.length > 1
    ? `${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}`
    : (labels[0] ?? '')

function messageOf(
  conflict: SheetConflict,
  labels: readonly string[],
  others: number
): string {
  const many = labels.length > 1
  // Quem mudou, quando é um campo só e se sabe ("pelo narrador")
  const only = conflict.paths.length === 1 ? conflict.paths[0] : undefined
  const by = only ? conflict.changedBy?.[only] : null
  const who = by ? ` ${changedByText(by)}` : ''
  if (conflict.origin === 'play')
    return `${names(labels)} ${many ? 'mudaram' : 'mudou'} antes de a sua alteração chegar. A ficha mostra o valor de agora.`
  if (conflict.origin === 'recovery')
    return `${names(labels)} ${many ? 'mudaram' : 'mudou'} desde o seu rascunho.`
  const rest =
    others === 1
      ? ' A outra continua no rascunho.'
      : others > 1
        ? ` As outras ${others} continuam no rascunho.`
        : ''
  return `${names(labels)} ${many ? 'foram alterados' : 'foi alterado'}${who} antes de a sua alteração chegar.${rest}`
}

export function ConflictBanner() {
  const { model } = useSheet()
  const conflict = useSheetSelector(s => s.conflict, jsonEqual)
  const drafted = useSheetSelector(s => s.draft?.size ?? 0)
  const [open, setOpen] = useState(false)
  if (!conflict) return null
  const labels = [...new Set(conflict.paths.map(p => conflictLabel(model, p)))]
  return (
    <View style={styles.wrap}>
      <Banner
        tone="warning"
        title="A ficha mudou em outro lugar"
        message={messageOf(
          conflict,
          labels,
          Math.max(0, drafted - conflict.paths.length)
        )}
        action={
          <Button
            title="Revisar"
            variant="secondary"
            accessibilityHint="Mostra o seu valor e o valor de agora de cada campo"
            onPress={() => setOpen(true)}
          />
        }
      />
      <ConflictSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[3],
  },
})
