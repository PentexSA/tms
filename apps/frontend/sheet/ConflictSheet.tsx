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
  const rows = useSheetSelector(
    s =>
      (s.conflict?.paths ?? []).map(path => {
        // O seu: a entrada do rascunho, ou o último `to` do lote do Jogo
        let mine: unknown = s.draft?.get(path)?.to
        if (s.conflict?.origin === 'play')
          for (const b of s.conflict.batches)
            for (const e of b.events) if (e.path === path) mine = e.to
        return { path, mine, current: valueAt(s.values, path) }
      }),
    jsonEqual
  )
  if (!conflict) return null
  const play = conflict.origin === 'play'
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
                onPress={() => {
                  store.getState().dismissConflict()
                  onClose()
                }}
              />
            </View>
            <Button
              title="Reaplicar tudo"
              onPress={() => {
                store.getState().reapply()
                onClose()
              }}
            />
          </>
        ) : undefined
      }
    >
      <View style={styles.rows}>
        {play ? (
          <Text color="inkMuted">
            Uma ação do Jogo mexe em campos ligados: ela volta inteira ou não
            volta.
          </Text>
        ) : null}
        {rows.map(row => {
          const mine = describeValue(model, row.path, row.mine)
          const current = `${describeValue(model, row.path, row.current)} · alterado ${changedByText(conflict.changedBy?.[row.path])}`
          const place = placeOf(model, row.path)
          return (
            <View key={row.path} style={styles.row} testID="conflict-row">
              <Text variant="fieldLabel">{place}</Text>
              <View
                accessible
                accessibilityLabel={`${place}. Seu valor: ${mine}. Valor atual: ${current}.`}
                style={styles.values}
              >
                <Text>{`Seu valor: ${mine}`}</Text>
                <Text color="inkMuted">{`Valor atual: ${current}`}</Text>
              </View>
              {play ? null : (
                <View style={styles.actions}>
                  <Button
                    title="Ficar com o atual"
                    variant="ghost"
                    accessibilityHint={`${place}: tira a sua alteração do rascunho`}
                    onPress={() =>
                      store.getState().resolveConflict(row.path, 'theirs')
                    }
                  />
                  <Button
                    title="Usar o meu"
                    variant="secondary"
                    accessibilityHint={`${place}: o seu valor substitui o atual ao salvar`}
                    onPress={() =>
                      store.getState().resolveConflict(row.path, 'mine')
                    }
                  />
                </View>
              )}
            </View>
          )
        })}
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
