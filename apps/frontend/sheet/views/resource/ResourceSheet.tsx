import {
  type ActionPlan,
  describe,
  describeBatch,
  IMPLEMENTED_EFFECTS,
  planAction,
  type ResolvedResource,
  type ResourceValue,
  resourceRules,
  short,
  stored,
} from '@tms/sheet-core'
import { Button, Stepper, Text, tokens } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector, useSheetStore } from '../../context'
import { ActionPreview } from '../../play/ActionPreview'
import { eventTo, useEditable } from '../../play/editable'
import { haptics } from '../../play/haptics'
import { useCommit } from '../../useCommit'
import type { FieldViewProps } from '../types'
import { ResourceVisual } from './ResourceVisual'

// O sheet de um recurso (design system: Resource): o valor grande, o stepper
// do atual, gastar e recuperar com os verbos do template, o gasto máximo por
// turno e as ações com custo, sempre com prévia. A regra (teto, temporários
// primeiro, custo) é do core; aqui só se escolhe e se mostra.

// Sem teto (Pontos de Destino acima da recarga): o stepper ainda precisa de um.
const NO_CAP = 999

export function ResourceSheet({ resolved, sheet }: FieldViewProps) {
  const r = resolved as ResolvedResource
  const def = r.field.def
  const name = def.shortLabel ?? def.label
  const { model } = useSheet()
  const store = useSheetStore()
  const commit = useCommit()
  const { editable, reason } = useEditable(r.id)
  // Disponibilidade das ações depende de outros campos (Curar olha a Vitalidade)
  const values = useSheetSelector(s => s.values)
  const [preview, setPreview] = useState<Extract<
    ActionPlan,
    { ok: true }
  > | null>(null)

  const change = (to: ResourceValue) => {
    const events = [eventTo(store.getState().values, r.id, to)]
    const result = commit(events, describeBatch(model, events))
    if (result.ok) haptics.selection()
  }
  const base = stored(r, sheet) as ResourceValue

  if (preview)
    return (
      <ActionPreview
        plan={preview}
        onBack={() => setPreview(null)}
        onApply={() => {
          const result = commit(preview.events, preview.label)
          if (result.ok) haptics.impact()
          setPreview(null)
        }}
      />
    )

  const max = r.cap ?? Math.max(NO_CAP, r.current)
  const damageFirst = def.defaultAction === 'damage1'
  const actions = (def.actions ?? []).filter(a =>
    IMPLEMENTED_EFFECTS.has(a.effect)
  )

  return (
    <View style={styles.box}>
      <View
        accessible
        accessibilityLabel={describe(r, sheet)}
        accessibilityValue={{ text: short(r, sheet) }}
        style={styles.value}
      >
        <Text variant="numberLg">{String(r.current)}</Text>
        {r.shownMax !== null ? (
          <Text color="inkMuted">{`de ${r.shownMax}`}</Text>
        ) : null}
        {r.temp ? (
          <Text color="inkMuted">{`+${r.temp} temporários`}</Text>
        ) : null}
      </View>
      <ResourceVisual r={r} />

      {editable ? (
        <>
          <View style={styles.line}>
            <Text variant="fieldLabel" style={styles.grow}>
              Atual
            </Text>
            <Stepper
              label={`${name} atual`}
              size="sheet"
              value={r.current}
              min={0}
              max={max}
              valueText={n =>
                r.shownMax !== null ? `${n} de ${r.shownMax}` : String(n)
              }
              onChange={n => change(resourceRules.setCurrent(r, n))}
              testID={`${r.id}-current`}
            />
          </View>
          <View style={styles.buttons}>
            {damageFirst ? (
              <Button
                title="Sofrer 1 de dano"
                variant="secondary"
                disabled={r.current === 0 && !r.temp}
                onPress={() => change(resourceRules.takeDamage(r, 1))}
              />
            ) : (
              <Button
                title={def.spendLabel ?? 'Gastar 1'}
                variant="secondary"
                disabled={r.current === 0}
                accessibilityHint={`Gasta 1 de ${name}`}
                onPress={() => change(resourceRules.spend(r, 1))}
              />
            )}
            <Button
              title={def.gainLabel ?? 'Recuperar 1'}
              variant="secondary"
              disabled={r.cap !== null && r.current >= r.cap}
              accessibilityHint={`Recupera 1 de ${name}`}
              onPress={() => change(resourceRules.gain(r, 1))}
            />
          </View>
          {def.temp ? (
            <View style={styles.line}>
              <Text variant="fieldLabel" style={styles.grow}>
                Temporários
              </Text>
              <Stepper
                label={`${name} temporários`}
                value={r.temp ?? 0}
                min={0}
                max={NO_CAP}
                onChange={n => change({ ...base, temp: n })}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {r.perTurn !== null ? (
        <Text color="inkMuted">{`Gasto máximo por turno: ${r.perTurn}`}</Text>
      ) : null}
      {r.permanent !== null ? (
        <Text color="inkMuted">
          {`Permanente ${r.permanent} · muda só em Evoluir`}
        </Text>
      ) : null}
      {def.help ? <Text color="inkMuted">{def.help}</Text> : null}
      {reason ? (
        <Text variant="caption" color="inkMuted">
          {reason}
        </Text>
      ) : null}

      {editable && actions.length ? (
        <View style={styles.actions}>
          {actions.map(action => {
            const plan = planAction(model, values, action, r.id)
            const cost = action.cost ? ` (${action.cost} ${name})` : ''
            return (
              <View key={action.id} style={styles.action}>
                <Button
                  title={`${action.label}${cost}`}
                  variant="secondary"
                  disabled={!plan.ok}
                  accessibilityHint={plan.ok ? 'Mostra a prévia' : plan.reason}
                  onPress={() => plan.ok && setPreview(plan)}
                />
                {!plan.ok ? (
                  <Text variant="caption" color="inkMuted">
                    {plan.reason}
                  </Text>
                ) : null}
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: tokens.space[3], paddingVertical: tokens.space[2] },
  value: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space[2] },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  grow: { flex: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[3] },
  actions: { gap: tokens.space[3], paddingTop: tokens.space[2] },
  action: { gap: tokens.space[1] },
})
