import { Choice, Text } from '@tms/ui'
import { View } from 'react-native'
import type { EditorProps } from './types'

export function ChoiceEditor({ id, def, value, onChange, error }: EditorProps) {
  if (def.type !== 'choice' && def.type !== 'state') return null
  return (
    <View testID={`editor-${id}`}>
      <Choice
        label={def.label}
        value={typeof value === 'string' ? value : null}
        onChange={onChange}
        options={def.options.map(o => ({
          id: o.id,
          label: o.label,
          meta: 'meta' in o ? o.meta : 'hint' in o ? o.hint : undefined,
        }))}
      />
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  )
}
