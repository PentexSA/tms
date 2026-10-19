import { BottomSheet, Choice, Pressable, Text, tokens, useTheme } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { FieldViewProps } from '../views/types'
import { useCompact } from './compact'
import { useFieldIssue, useSetDraft } from './hooks'

// choice e state em Evoluir: a linha abre um radiogroup no sheet. Trocar o
// Clã (o campo do accent no template) já muda a cor da ficha, porque o
// rascunho é o que a tela resolve.

export function ChoiceEditorRow({ resolved }: FieldViewProps) {
  const { colors } = useTheme()
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  const compact = useCompact()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (resolved.type !== 'choice' && resolved.type !== 'state') return null
  const def = resolved.field.def
  const current = resolved.option
  const label = current?.label ?? '—'
  return (
    <>
      <Pressable
        testID={`editor-${resolved.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${def.label}: ${label}`}
        accessibilityValue={current ? { text: current.label } : undefined}
        accessibilityHint="Abre as opções"
        onPress={() => {
          setError(null)
          setOpen(true)
        }}
        style={[
          styles.row,
          compact && styles.compact,
          { borderBottomColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.text}>
          <Text variant="fieldLabel">{def.label}</Text>
          <Text color={current ? 'ink' : 'inkMuted'}>{label}</Text>
          {issue ? (
            <Text variant="caption" color="danger" accessibilityRole="alert">
              {issue}
            </Text>
          ) : null}
        </View>
        {compact ? null : (
          <Text variant="caption" color="action">
            Trocar
          </Text>
        )}
      </Pressable>
      <BottomSheet
        visible={open}
        title={def.label}
        onClose={() => setOpen(false)}
      >
        {error ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Choice
          label={def.label}
          value={current?.id ?? null}
          options={def.options.map(o => ({
            id: o.id,
            label: o.label,
            meta: 'meta' in o ? o.meta : 'hint' in o ? o.hint : undefined,
          }))}
          onChange={id => {
            const err = set(`values.${resolved.id}`, id)
            setError(err)
            if (!err) setOpen(false)
          }}
        />
      </BottomSheet>
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  compact: { paddingHorizontal: 0, paddingVertical: tokens.space[1] },
  text: { flex: 1, gap: tokens.space['0.5'] },
})
