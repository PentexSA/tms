import { jsonEqual, type SheetModel } from '@tms/sheet-core'
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
  model: SheetModel,
  conflict: SheetConflict,
  others: number
): string {
  const labelsOf = (paths: readonly string[]) => [
    ...new Set(paths.map(p => conflictLabel(model, p))),
  ]
  const parts: string[] = []
  const draft = conflict.draft
  if (draft) {
    const labels = labelsOf(draft.paths)
    const many = labels.length > 1
    if (draft.origin === 'recovery')
      parts.push(
        `${names(labels)} ${many ? 'mudaram' : 'mudou'} desde o seu rascunho.`
      )
    else {
      // Quem mudou, quando é um campo só e se sabe ("pelo narrador")
      const only = draft.paths.length === 1 ? draft.paths[0] : undefined
      const by = only ? conflict.changedBy?.[only] : null
      const who = by ? ` ${changedByText(by)}` : ''
      const rest =
        others === 1
          ? ' A outra continua no rascunho.'
          : others > 1
            ? ` As outras ${others} continuam no rascunho.`
            : ''
      parts.push(
        `${names(labels)} ${many ? 'foram alterados' : 'foi alterado'}${who} antes de a sua alteração chegar.${rest}`
      )
    }
  }
  if (conflict.play) {
    const labels = labelsOf(conflict.play.paths)
    parts.push(
      `${names(labels)} ${labels.length > 1 ? 'mudaram' : 'mudou'} antes de a sua alteração chegar. A ficha mostra o valor de agora.`
    )
  }
  return parts.join(' ')
}

export function ConflictBanner() {
  const { model } = useSheet()
  const conflict = useSheetSelector(s => s.conflict, jsonEqual)
  const drafted = useSheetSelector(s => s.draft?.size ?? 0)
  const [open, setOpen] = useState(false)
  if (!conflict) return null
  const others = Math.max(0, drafted - (conflict.draft?.paths.length ?? 0))
  return (
    <View style={styles.wrap}>
      <Banner
        tone="warning"
        title="A ficha mudou em outro lugar"
        message={messageOf(model, conflict, others)}
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
