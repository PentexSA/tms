import {
  describeValue,
  fieldPlace,
  jsonEqual,
  parsePath,
  type SheetModel,
} from '@tms/sheet-core'
import { BottomSheet, Button, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector, useSheetStore } from './context'
import { type ChangedBy, valueAt } from './store/sheetStore'

// A folha "Campos em conflito" (T-31): o seu valor e o de agora, campo a
// campo, com a escolha na mesma linha. No rascunho, cada campo se resolve
// sozinho; no Jogo, a ação volta inteira ("Reaplicar tudo") ou não volta.

/** "Força", "Força (especialização)". */
export function conflictLabel(model: SheetModel, path: string): string {
  const parsed = parsePath(path)
  const label = parsed
    ? (model.fields.get(parsed.fieldId)?.def.label ?? parsed.fieldId)
    : path
  return parsed?.scope === 'specialties' ? `${label} (especialização)` : label
}

/** Quem mudou, pelo papel relativo; nunca o nome. */
export const changedByText = (by: ChangedBy | undefined): string =>
  by === 'storyteller'
    ? 'pelo narrador'
    : by === 'owner'
      ? 'pelo jogador'
      : by === 'self'
        ? 'por você, em outro aparelho'
        : 'em outro lugar'

/** "Identidade › Senhor": onde o campo aparece na ficha. */
function placeOf(model: SheetModel, path: string): string {
  const parsed = parsePath(path)
  const place = parsed ? fieldPlace(model, parsed.fieldId) : null
  return [place?.section, place?.group, conflictLabel(model, path)]
    .filter(Boolean)
    .join(' › ')
}

/** Seu valor × valor atual, campo a campo. */
export function ConflictSheet({
  visible,
  onClose,
}: {
  readonly visible: boolean
  readonly onClose: () => void
}) {
  const { model } = useSheet()
  const store = useSheetStore()
  const conflict = useSheetSelector(s => s.conflict, jsonEqual)
  const rows = useSheetSelector(s => {
    const out: {
      kind: 'draft' | 'play'
      path: string
      mine: unknown
      current: unknown
    }[] = []
    // Os do rascunho: o seu é a entrada dele, e cada um se resolve sozinho
    for (const path of s.conflict?.draft?.paths ?? [])
      out.push({
        kind: 'draft',
        path,
        mine: s.draft?.get(path)?.to,
        current: valueAt(s.values, path),
      })
    // Os do Jogo: o seu é o último `to` dos lotes, que voltam juntos
    for (const path of s.conflict?.play?.paths ?? []) {
      let mine: unknown
      for (const b of s.conflict?.play?.batches ?? [])
        for (const e of b.events) if (e.path === path) mine = e.to
      out.push({ kind: 'play', path, mine, current: valueAt(s.values, path) })
    }
    return out
  }, jsonEqual)
  if (!conflict) return null
  const play = conflict.play !== null
  const row = (r: (typeof rows)[number]) => {
    const mine = describeValue(model, r.path, r.mine)
    const current = `${describeValue(model, r.path, r.current)} · alterado ${changedByText(conflict.changedBy?.[r.path])}`
    const place = placeOf(model, r.path)
    return (
      <View
        key={`${r.kind}:${r.path}`}
        style={styles.row}
        testID="conflict-row"
      >
        <Text variant="fieldLabel">{place}</Text>
        <View
          accessible
          accessibilityLabel={`${place}. Seu valor: ${mine}. Valor atual: ${current}.`}
          style={styles.values}
        >
          <Text>{`Seu valor: ${mine}`}</Text>
          <Text color="inkMuted">{`Valor atual: ${current}`}</Text>
        </View>
        {r.kind === 'play' ? null : (
          <View style={styles.actions}>
            <Button
              title="Ficar com o atual"
              // Um par de botões por campo: o nome diz qual (T-61)
              accessibilityLabel={`Ficar com o atual: ${place}`}
              variant="ghost"
              accessibilityHint={`${place}: tira a sua alteração do rascunho`}
              onPress={() => store.getState().resolveConflict(r.path, 'theirs')}
            />
            <Button
              title="Usar o meu"
              accessibilityLabel={`Usar o meu: ${place}`}
              variant="secondary"
              accessibilityHint={`${place}: o seu valor substitui o atual ao salvar`}
              onPress={() => store.getState().resolveConflict(r.path, 'mine')}
            />
          </View>
        )}
      </View>
    )
  }
  return (
    <BottomSheet
      visible={visible}
      title="Campos em conflito"
      onClose={onClose}
      testID="conflict-sheet"
      footer={
        play ? (
          <>
            <View style={styles.secondary}>
              <Button
                title="Manter como está"
                variant="ghost"
                accessibilityHint="Os lotes do Jogo em conflito saem; a ficha fica com o valor de agora"
                onPress={() => {
                  store.getState().dismissConflict()
                  if (!store.getState().conflict) onClose()
                }}
              />
            </View>
            <Button
              title="Reaplicar tudo"
              accessibilityHint="Os lotes do Jogo em conflito voltam inteiros, sobre o valor de agora"
              onPress={() => {
                store.getState().reapply()
                if (!store.getState().conflict) onClose()
              }}
            />
          </>
        ) : undefined
      }
    >
      <View style={styles.rows}>
        {rows.filter(r => r.kind === 'draft').map(row)}
        {play ? (
          <Text color="inkMuted">
            Uma ação do Jogo mexe em campos ligados: ela volta inteira ou não
            volta.
          </Text>
        ) : null}
        {rows.filter(r => r.kind === 'play').map(row)}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  rows: { gap: tokens.space[4] },
  row: { gap: tokens.space[1] },
  values: { gap: tokens.space['0.5'] },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[2],
    justifyContent: 'flex-end',
  },
  secondary: { flex: 1, alignItems: 'flex-start' },
})
