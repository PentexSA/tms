import type { Ref } from 'react'
import { useId } from 'react'
import {
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from 'react-native'
import { type Help, WithHelp } from './HelpButton'
import { hitTarget } from './metrics'
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
  /** O "?" ao lado do rótulo, com a frase de ajuda abaixo dele (R-19). */
  readonly help?: Help | null
  // Mostra o contador "12/80" quando há maxLength.
  readonly counter?: boolean
  // Com o React 19 o ref é prop: quem chama foca o campo (T-21). O `...rest`
  // o leva ao TextInput
  readonly ref?: Ref<TextInputInstance>
}

export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  help,
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
      <WithHelp help={help}>
        <Text variant="fieldLabel" nativeID={`${id}-label`}>
          {label}
        </Text>
      </WithHelp>
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
          { minHeight: hitTarget() },
          multiline && styles.multiline,
          {
            color: colors.ink,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.borderControl,
          },
        ]}
        {...rest}
      />
      {/* T-64: a dica (ou o erro) quebra em linhas e o contador fica
          inteiro à direita, com um respiro entre os dois */}
      <View style={styles.meta}>
        {error ? (
          <Text
            variant="caption"
            color="danger"
            accessibilityRole="alert"
            style={styles.note}
          >
            {error}
          </Text>
        ) : hint ? (
          <Text variant="caption" color="inkMuted" style={styles.note}>
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
            style={styles.counter}
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
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[2],
  },
  multiline: { minHeight: 120 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.space[2],
  },
  note: { flex: 1 },
  counter: { flexShrink: 0 },
})
