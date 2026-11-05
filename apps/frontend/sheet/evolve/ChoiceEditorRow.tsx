import { BottomSheet, Choice, Pressable, Text, tokens, useTheme } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { FieldViewProps } from '../views/types'
import { fieldA11y } from './a11y'
import { useCompact } from './compact'
import { useFieldIssue, useSetDraft } from './hooks'
import { badgeText, outsideText, useIdentityAdvice } from './recommend'

// choice e state em Evoluir: a linha abre um radiogroup no sheet. Trocar o
// Clã (o campo do accent no template) já muda a cor da ficha, porque o
// rascunho é o que a tela resolve.
//
// Com `recommend` no template (a Esfera de afinidade pela Tradição, R-26), as
// opções recomendadas vêm primeiro, com o selo no texto secundário, que o
// Choice lê no nome ("Forças, da Tradição"). Na criação, uma escolha fora
// avisa sob o valor, sem bloquear.

export function ChoiceEditorRow({ resolved }: FieldViewProps) {
  const { colors } = useTheme()
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  const compact = useCompact()
  // Pelo store: trocar a Tradição não muda a entrada deste campo
  const identity = useIdentityAdvice(resolved.id)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (resolved.type !== 'choice' && resolved.type !== 'state') return null
  const def = resolved.field.def
  const current = resolved.option
  const label = current?.label ?? '—'
  const { recommended } = identity
  const options = def.options
    .map(o => {
      const own = 'meta' in o ? o.meta : 'hint' in o ? o.hint : undefined
      const badge = badgeText(recommended.get(o.id))
      return {
        id: o.id,
        label: o.label,
        meta: [own, badge].filter(Boolean).join(' · ') || undefined,
      }
    })
    // Estável: as recomendadas na frente, cada parte na ordem do template
    .sort(
      (a, b) => Number(recommended.has(b.id)) - Number(recommended.has(a.id))
    )
  const outside =
    identity.recommend &&
    identity.advice.get(`values.${resolved.id}`)?.includes('ADVICE_OUTSIDE')
      ? outsideText(identity.recommend)
      : null
  return (
    <>
      <Pressable
        testID={`editor-${resolved.id}`}
        accessibilityRole="button"
        {...fieldA11y(def.label, label)}
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
          {outside ? (
            <Text
              variant="caption"
              color="inkMuted"
              testID={`identity-${resolved.id}`}
            >
              {outside}
            </Text>
          ) : null}
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
          showLabel={false}
          value={current?.id ?? null}
          options={options}
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
