import { useId } from 'react'
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native'
import { Text } from './Text'
import { textStyle, useTheme } from './theme'
import { tokens } from './tokens'

export interface TextFieldProps
  extends Omit<TextInputProps, 'style' | 'onChange'> {
  readonly label: string
  readonly value: string
  readonly onChangeText: (text: string) => void
  readonly error?: string | null
  readonly hint?: string
  // Mostra o contador "12/80" quando há maxLength.
  readonly counter?: boolean
}

export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  counter = true,
  maxLength,
  multiline,
  testID,
  ...rest
}: TextFieldProps) {
  const theme = useTheme()
  const id = useId()
  const { colors } = theme
  return (
    <View style={styles.root}>
      <Text variant="fieldLabel" nativeID={`${id}-label`}>
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${id}-label`}
        accessibilityHint={error ?? hint}
        aria-invalid={error ? true : undefined}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        multiline={multiline}
        placeholderTextColor={colors.inkMuted}
        style={[
          textStyle(theme, 'body'),
          styles.input,
          multiline && styles.multiline,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.borderControl,
          },
        ]}
        {...rest}
      />
      <View style={styles.meta}>
        {error ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : hint ? (
          <Text variant="caption" color="inkMuted">
            {hint}
          </Text>
        ) : (
          <View />
        )}
        {counter && maxLength ? (
          <Text
            variant="numberSm"
            color="inkMuted"
            accessibilityLabel={`${value.length} de ${maxLength} caracteres`}
          >
            {`${value.length}/${maxLength}`}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export function TextArea(props: TextFieldProps) {
  return <TextField multiline textAlignVertical="top" {...props} />
}

const styles = StyleSheet.create({
  root: { gap: tokens.space[1] },
  input: {
    minHeight: tokens.size.hitSize,
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
  },
  multiline: { minHeight: 120 },
  meta: { flexDirection: 'row', justifyContent: 'space-between' },
})
