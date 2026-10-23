import {
  canRead,
  describe,
  type FieldId,
  planDefaultAction,
  type Roles,
  type SheetModel,
} from '@tms/sheet-core'
import { Pressable, Text, tokens, useInsets, useTheme, useToast } from '@tms/ui'
import { memo } from 'react'
import {
  type AccessibilityActionEvent,
  AccessibilityInfo,
  StyleSheet,
  View,
} from 'react-native'
import { useFieldEntry, useSheet, useSheetStore } from '../context'
import { blockedBy, blockedNote, refusalReason, useLifecycle } from '../policy'
import { useCommit } from '../useCommit'
import { resolveView } from '../views'
import { planLabel, useEditable } from './editable'
import { haptics } from './haptics'
import { useFieldSheet } from './sheetContext'

// Recursos de combate na zona do polegar (design system: CombatDock). Os
// campos vêm de `template.dock` (de 1 a 3): Vampiro [Vitalidade, Sangue, FdV],
// D&D [PV, CA, Espaços], Fate [Estresse, Destino, Consequências]. Toque abre
// o sheet; toque longo aplica a ação padrão do campo, com Desfazer no aviso.
// Com a ficha travada (ou arquivada), o toque não abre o sheet de gasto: diz
// o motivo, também ao leitor de tela.

export const LONG_PRESS_MS = 500
const MAX_DOCK = 3

/** Os campos do dock que o papel lê, na ordem do template. */
export function dockFields(model: SheetModel, roles: Roles): FieldId[] {
  return model.template.dock
    .filter(id => model.fields.has(id) && canRead(model, id, roles))
    .slice(0, MAX_DOCK)
}

export function CombatDock() {
  const { model, roles } = useSheet()
  const { colors } = useTheme()
  const insets = useInsets()
  const sheets = useFieldSheet()
  const ids = dockFields(model, roles)
  if (!ids.length) return null
  return (
    <View
      role="region"
      aria-label="Em jogo"
      style={[
        styles.dock,
        {
          backgroundColor: colors.surfaceRaised,
          borderTopColor: colors.borderSubtle,
          paddingBottom: tokens.space[2] + insets.bottom,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Todos os recursos"
        onPress={() => sheets?.open({ kind: 'all' })}
        style={styles.handle}
      >
        <Text variant="caption" color="inkMuted">
          Todos os recursos
        </Text>
      </Pressable>
      <View style={styles.row}>
        {ids.map(id => (
          <DockChip key={id} id={id} />
        ))}
      </View>
    </View>
  )
}

const DockChip = memo(function DockChip({ id }: { readonly id: FieldId }) {
  const { model, roles } = useSheet()
  const lifecycle = useLifecycle()
  const store = useSheetStore()
  const commit = useCommit()
  const toast = useToast()
  const sheets = useFieldSheet()
  const { colors } = useTheme()
  const { editable } = useEditable(id)
  const entry = useFieldEntry(id)
  const blocked = blockedBy(roles, lifecycle, 'play')
  if (!entry) return null
  const why = blocked ? (refusalReason(blocked) ?? blockedNote(blocked)) : null
  const open = () => {
    if (!why) return sheets?.open({ kind: 'field', id })
    toast.show({ message: why })
    AccessibilityInfo.announceForAccessibility(why)
  }
  const { resolved, sheet } = entry
  // A ação padrão só depende do próprio campo: a entrada muda quando ela muda
  const def = resolved.field.def
  const hasDefault = editable && 'defaultAction' in def && !!def.defaultAction
  const plan = hasDefault
    ? planDefaultAction(model, store.getState().values, id)
    : null

  const runDefault = () => {
    const next = planDefaultAction(model, store.getState().values, id)
    if (!next.ok) {
      toast.show({ message: next.reason })
      return
    }
    if (commit(next.events, planLabel(next)).ok) haptics.impact()
  }
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'longpress') runDefault()
    if (e.nativeEvent.actionName === 'activate') open()
  }

  const ChipView = resolveView(model.skin, resolved.type, 'chip')
  const label = describe(resolved, sheet)
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        plan?.ok ? `${label}. Toque longo: ${plan.label}` : label
      }
      accessibilityActions={
        plan?.ok
          ? [{ name: 'activate' }, { name: 'longpress', label: plan.label }]
          : [{ name: 'activate' }]
      }
      accessibilityHint={why ?? undefined}
      onAccessibilityAction={onAction}
      onPress={open}
      onLongPress={hasDefault ? runDefault : undefined}
      delayLongPress={LONG_PRESS_MS}
      testID={`dock-${id}`}
      style={[styles.chip, { borderColor: colors.borderSubtle }]}
    >
      <ChipView resolved={resolved} sheet={sheet} />
    </Pressable>
  )
})

const styles = StyleSheet.create({
  dock: {
    borderTopWidth: tokens.borderWidth.hair,
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[1],
    gap: tokens.space[1],
  },
  handle: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: tokens.space[2] },
  chip: {
    flex: 1,
    minHeight: tokens.size.dockHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: tokens.borderWidth.hair,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.space[1],
  },
})
