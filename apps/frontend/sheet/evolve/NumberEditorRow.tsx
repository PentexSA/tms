import { inactiveNote, modifierNote } from '@tms/sheet-core'
import { Stepper, Text, textStyle, tokens, useTheme } from '@tms/ui'
import { useEffect, useId, useRef, useState } from 'react'
import { Platform, StyleSheet, TextInput } from 'react-native'
import type { FieldViewProps } from '../views/types'
import { EditorShell } from './EditorShell'
import { useBlockedNote, useFieldIssue, useSetDraft } from './hooks'
import { SpecialtyEditor } from './SpecialtyEditor'
import { parseTyped, typingStore, useTyping } from './typing'

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
  const [error, setError] = useState<string | null>(null)
  const instance = useId()
  const typing = useTyping(instance)
  // O texto digitado e a trava de execução única (o app dispara o fim da
  // edição junto do Enter)
  const text = useRef('')
  const done = useRef(true)
  // Sumir com o campo aberto (outra aba) não deixa o store apontando para cá
  useEffect(() => () => typingStore.close(instance), [instance])
  // Enter e Esc desmontam o campo focado: no web, o foco volta ao "Digitar"
  // (sem isso cairia no body). Ao sair com Tab ou clique, o foco já foi
  // para onde a pessoa quis.
  const valueId = `${instance}-digitar`
  const refocus = useRef(false)
  useEffect(() => {
    if (typing || !refocus.current) return
    refocus.current = false
    if (Platform.OS !== 'web') return
    const doc = (
      globalThis as {
        document?: { getElementById?: (id: string) => unknown }
      }
    ).document
    const button = doc?.getElementById?.(valueId) as
      | { focus?: () => void }
      | null
      | undefined
    button?.focus?.()
  }, [typing, valueId])
  const range = rangeOf(props)
  if (!range) return null
  const def = resolved.field.def
  const path = `values.${resolved.id}`
  const apply = (n: number) => setError(set(path, n))
  // O evento traz o texto quando pode (Enter no app; Enter e blur no web);
  // senão vale o último onChangeText
  const textOf = (e: { nativeEvent: unknown }) => {
    const t = (e.nativeEvent as { text?: unknown } | undefined)?.text
    if (typeof t === 'string') text.current = t
  }
  const finish = (how: 'submit' | 'leave') => {
    if (done.current) return
    const n = parseTyped(text.current, range.min, range.max)
    if (n === null) {
      setError(`Digite um número inteiro de ${range.min} a ${range.max}`)
      // Enter: o campo fica aberto para corrigir
      if (how === 'submit') return
    }
    done.current = true
    refocus.current = how === 'submit'
    typingStore.close(instance)
    if (n !== null) apply(n)
  }
  // Esc: fecha sem aplicar e sem a mensagem de um valor que não vai valer
  const cancel = () => {
    done.current = true
    refocus.current = true
    setError(null)
    typingStore.close(instance)
  }
  const open = () => {
    text.current = String(range.value)
    done.current = false
    setError(null)
    typingStore.open(instance, () => finish('leave'))
  }
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
      sub={blocked}
      error={error ?? issue}
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
          returnKeyType="done"
          autoFocus
          selectTextOnFocus
          defaultValue={String(range.value)}
          // O sinal de negativo cabe; decimal é recusado com a mensagem
          maxLength={
            Math.max(String(range.min).length, String(range.max).length) + 1
          }
          onChangeText={t => {
            text.current = t
          }}
          // Enter não tira o foco: com valor inválido, o campo fica aberto
          submitBehavior="submit"
          {...(Platform.OS === 'web' ? { blurOnSubmit: false } : {})}
          onSubmitEditing={e => {
            textOf(e)
            finish('submit')
          }}
          onBlur={e => {
            textOf(e)
            finish('leave')
          }}
          onKeyPress={e => {
            if (e.nativeEvent.key === 'Escape') cancel()
          }}
          style={[
            styles.input,
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
          onValuePress={blocked ? undefined : open}
          valueNativeID={valueId}
        />
      )}
    </EditorShell>
  )
}

const styles = StyleSheet.create({
  input: {
    minWidth: 72,
    minHeight: tokens.size.hitSize,
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[3],
    textAlign: 'center',
  },
})
