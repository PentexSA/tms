import { describe, plain } from '@tms/sheet-core'
import { Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useEditable } from '../play/editable'
import type { FieldViewProps } from './types'

// O sheet de qualquer campo sem sheet próprio: o valor por extenso, a ajuda
// do template e, quando não dá para mexer, o porquê ("Traço permanente: muda
// só em Evoluir"). Nada de stepper aqui: em Jogo, só muda o que o template
// marca com `play` em `editableIn`.
export function FieldDetail({ resolved, sheet }: FieldViewProps) {
  const { reason } = useEditable(resolved.id)
  const def = resolved.field.def
  const value = plain(resolved, sheet)
  return (
    <View style={styles.box}>
      <View accessible accessibilityLabel={describe(resolved, sheet)}>
        <Text variant="numberLg">{value || '—'}</Text>
      </View>
      {def.help ? <Text color="inkMuted">{def.help}</Text> : null}
      {reason ? (
        <Text variant="caption" color="inkMuted">
          {reason}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: tokens.space[3], paddingVertical: tokens.space[2] },
})
