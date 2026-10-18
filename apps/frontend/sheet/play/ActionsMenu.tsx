import {
  type ActionPlan,
  IMPLEMENTED_EFFECTS,
  planAction,
  type TemplateAction,
} from '@tms/sheet-core'
import { Button, IconButton, Text, tokens } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector } from '../context'
import { useCommit } from '../useCommit'
import { ActionPreview } from './ActionPreview'
import { haptics } from './haptics'
import { useFieldSheet } from './sheetContext'

// Menu ⋯ com as ações do template (Despertar), sempre com prévia. Ação de
// efeito que esta versão não aplica fica escondida.

export const availableActions = (
  actions: readonly TemplateAction[] | undefined
): TemplateAction[] =>
  (actions ?? []).filter(a => IMPLEMENTED_EFFECTS.has(a.effect))

/** O botão ⋯ da ficha em Jogo; some quando o template não tem ação. */
export function ActionsButton() {
  const { model } = useSheet()
  const sheets = useFieldSheet()
  if (!sheets || !availableActions(model.template.actions).length) return null
  return (
    <IconButton
      label="Ações da ficha"
      glyph="⋯"
      onPress={() => sheets.open({ kind: 'actions' })}
    />
  )
}

export function ActionsMenu() {
  const { model } = useSheet()
  const values = useSheetSelector(s => s.values)
  const commit = useCommit()
  const sheets = useFieldSheet()
  const [preview, setPreview] = useState<Extract<
    ActionPlan,
    { ok: true }
  > | null>(null)

  if (preview)
    return (
      <ActionPreview
        plan={preview}
        onBack={() => setPreview(null)}
        onApply={() => {
          const result = commit(preview.events, preview.label)
          if (result.ok) haptics.impact()
          // Fecha: o aviso com Desfazer fica à vista
          sheets?.close()
        }}
      />
    )

  return (
    <View style={styles.list}>
      {availableActions(model.template.actions).map(action => {
        const plan = planAction(model, values, action)
        return (
          <View key={action.id} style={styles.item}>
            <Button
              title={action.label}
              variant="secondary"
              disabled={!plan.ok}
              accessibilityHint={plan.ok ? 'Mostra a prévia' : plan.reason}
              onPress={() => plan.ok && setPreview(plan)}
            />
            {!plan.ok ? (
              <Text variant="caption" color="inkMuted">
                {plan.reason}
              </Text>
            ) : action.help ? (
              <Text variant="caption" color="inkMuted">
                {action.help}
              </Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: tokens.space[4], paddingVertical: tokens.space[2] },
  item: { gap: tokens.space[1] },
})
