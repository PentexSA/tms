import { inactiveNote, modifierNote } from '@tms/sheet-core'
import { hitTarget, Stepper, Text, textStyle, tokens, useTheme } from '@tms/ui'
import { useEffect, useId, useState } from 'react'
import { StyleSheet, TextInput } from 'react-native'
import type { FieldViewProps } from '../views/types'
import { BlockedNote } from './BlockedNote'
import { EditorShell } from './EditorShell'
import { fieldHelp } from './help'
import { useBlockedNote, useFieldIssue, useSetDraft } from './hooks'
import { SpecialtyEditor } from './SpecialtyEditor'
import { typingStore, useTyping } from './typing'
import { useRowFeedback } from './useRowFeedback'
import { useTypedValue } from './useTypedValue'

// rating, number e percent em Evoluir (DS: FieldRow com Stepper inline). O
// Stepper muda 1 por toque; tocar no valor abre o teclado numérico. O que
// passa da faixa do template o core recusa (e a mensagem aparece aqui). Com
// teto não destrutivo (`cap`, Esferas ≤ Arete), o Stepper passa do teto até o
// máximo do campo, e a linha diz quanto fica inativo.
//
// Digitar (T-25): Enter aplica; sair do campo (Tab, clique fora, outro campo
// aberto) também aplica; Esc cancela. Só inteiro na faixa: com Enter num
// valor inválido o campo fica aberto com a mensagem; ao sair, fecha sem
// aplicar e a mensagem fica na linha. Nada é salvo sem "Salvar": o valor vai
// para o rascunho, e o core e o servidor conferem de novo.

interface Range {
  readonly value: number
  readonly min: number
  readonly max: number
  readonly spoken: (n: number) => string
}

function rangeOf(props: FieldViewProps): Range | null {
  const r = props.resolved
  if (r.type === 'rating') {
    const { min = 0, max, cap } = r.field.def
    const ceiling = r.cap
    return {
      value: r.base,
      min,
      max,
      spoken: n =>
        cap && ceiling !== null && n > ceiling
          ? `${n} de ${max}, ${n - ceiling} inativo, ${cap.label} ${ceiling}`
          : `${n} de ${max}`,
    }
  }
  if (r.type === 'percent') {
    const max = r.field.def.max ?? 99
    return { value: r.base, min: 0, max, spoken: n => `${n}%` }
  }
  if (r.type === 'number') {
    const { min = 0, max = 1_000_000, suffix = '' } = r.field.def
    return { value: r.value, min, max, spoken: n => `${n}${suffix}` }
  }
  return null
}

export function NumberEditorRow(props: FieldViewProps) {
  const { resolved, sheet } = props
  const theme = useTheme()
  const { colors } = theme
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  const blocked = useBlockedNote(resolved.id)
  const path = `values.${resolved.id}`
  // A recusa de um toque mora no store e some quando a causa some (T-55);
  // só o erro do "Digitar" é local, porque é do campo aberto. Na criação, a
  // previsão do próximo ponto vai no "+" (T-20, R-17)
  const feedback = useRowFeedback(path, resolved.id)
  const [error, setError] = useState<string | null>(null)
  const instance = useId()
  const typing = useTyping(instance)
  // Sumir com o campo aberto (outra aba) não deixa o store apontando para cá
  useEffect(() => () => typingStore.close(instance), [instance])
  const range = rangeOf(props)
  const apply = (n: number) => {
    setError(null)
    set(path, n)
  }
  // O "Digitar" comum (T-25): o mesmo do XP; aqui, um campo aberto por vez
  const typed = useTypedValue({
    min: range?.min ?? 0,
    max: range?.max ?? 0,
    value: range?.value ?? 0,
    typing,
    apply,
    setError,
    open: leave => typingStore.open(instance, leave),
    close: () => typingStore.close(instance),
  })
  if (!range) return null
  const def = resolved.field.def
  // O teto e, acima dele, o que fica inativo ("1 inativo, máx. pelo Arete 3")
  const capNote =
    resolved.type === 'rating' && resolved.field.def.cap
      ? (inactiveNote(resolved) ??
        `${resolved.field.def.cap.label} ${resolved.cap}`)
      : null
  // Em outro estado (Crinos), o stepper edita a base; o efetivo fica escrito
  const modNote =
    resolved.type === 'rating' && resolved.modded !== resolved.base
      ? `Efetivo ${resolved.value} (${modifierNote(resolved)})`
      : null
  const specialty =
    'specialty' in def && def.specialty ? (
      <SpecialtyEditor
        id={resolved.id}
        label={def.label}
        specialty={sheet.specialty(resolved.id)}
      />
    ) : null
  return (
    <EditorShell
      label={def.label}
      help={fieldHelp(def)}
      sub={
        blocked ? (
          <BlockedNote
            text={blocked}
            to={{ target: { field: resolved.id } }}
            subject={def.label}
          />
        ) : null
      }
      note={feedback.note}
      error={error ?? feedback.notice ?? issue}
      below={
        capNote || modNote || specialty ? (
          <>
            {modNote ? (
              <Text
                variant="caption"
                color="inkMuted"
                testID={`mod-${resolved.id}`}
              >
                {modNote}
              </Text>
            ) : null}
            {capNote ? (
              <Text
                variant="caption"
                color={
                  resolved.type === 'rating' && resolved.inactive
                    ? 'ink'
                    : 'inkMuted'
                }
                testID={`cap-${resolved.id}`}
              >
                {capNote}
              </Text>
            ) : null}
            {specialty}
          </>
        ) : null
      }
      testID={`editor-${resolved.id}`}
    >
      {typing ? (
        <TextInput
          accessibilityLabel={`${def.label}, de ${range.min} a ${range.max}`}
          keyboardType="number-pad"
          {...typed.inputProps}
          style={[
            styles.input,
            { minHeight: hitTarget() },
            textStyle(theme, 'number'),
            { borderColor: colors.borderControl, color: colors.ink },
          ]}
        />
      ) : (
        <Stepper
          label={def.label}
          value={range.value}
          min={range.min}
          max={range.max}
          onChange={apply}
          valueText={range.spoken}
          disabled={blocked !== null}
          onValuePress={blocked ? undefined : typed.start}
          valueNativeID={typed.valueId}
          increase={feedback.increase}
          decrease={feedback.decrease}
        />
      )}
    </EditorShell>
  )
}

const styles = StyleSheet.create({
  input: {
    minWidth: 72,
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[3],
    textAlign: 'center',
  },
})
