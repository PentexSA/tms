import { useEffect, useId, useRef } from 'react'
import { Platform } from 'react-native'
import { parseTyped } from './typing'

// O "Digitar" de um número (T-25), comum ao Editar (NumberEditorRow) e ao XP
// (Conceder e Ajustar, U-02): Enter aplica; sair do campo aplica; Esc
// cancela; fora da faixa, a mensagem, e com Enter o campo fica aberto. Enter
// e Esc desmontam o campo focado: no web, o foco volta ao "Digitar" (sem
// isso cairia no body). Ao sair com Tab ou clique, o foco já foi para onde
// a pessoa quis. Quem abre e fecha o campo é quem chama (um store único no
// Editar, um estado local no XP).

export interface TypedValueOptions {
  readonly min: number
  readonly max: number
  readonly value: number
  readonly typing: boolean
  readonly apply: (n: number) => void
  readonly setError: (message: string | null) => void
  // Abre o campo; recebe o "sair aplica" para quem fecha de fora (o store)
  readonly open: (leave: () => void) => void
  readonly close: () => void
}

export function useTypedValue({
  min,
  max,
  value,
  typing,
  apply,
  setError,
  open,
  close,
}: TypedValueOptions) {
  // O texto digitado e a trava de execução única (o app dispara o fim da
  // edição junto do Enter)
  const text = useRef('')
  const done = useRef(true)
  const valueId = `${useId()}-digitar`
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

  const finish = (how: 'submit' | 'leave') => {
    if (done.current) return
    const n = parseTyped(text.current, min, max)
    if (n === null) {
      setError(`Digite um número inteiro de ${min} a ${max}`)
      // Enter: o campo fica aberto para corrigir
      if (how === 'submit') return
    } else setError(null)
    done.current = true
    refocus.current = how === 'submit'
    close()
    if (n !== null) apply(n)
  }
  // Esc: fecha sem aplicar e sem a mensagem de um valor que não vai valer
  const cancel = () => {
    done.current = true
    refocus.current = true
    setError(null)
    close()
  }
  // O evento traz o texto quando pode (Enter no app; Enter e blur no web);
  // senão vale o último onChangeText
  const textOf = (e: { nativeEvent: unknown }) => {
    const t = (e.nativeEvent as { text?: unknown } | undefined)?.text
    if (typeof t === 'string') text.current = t
  }
  const start = () => {
    text.current = String(value)
    done.current = false
    setError(null)
    open(() => finish('leave'))
  }
  const inputProps = {
    returnKeyType: 'done' as const,
    autoFocus: true,
    selectTextOnFocus: true,
    defaultValue: String(value),
    // O sinal de negativo cabe; decimal é recusado com a mensagem
    maxLength: Math.max(String(min).length, String(max).length) + 1,
    onChangeText: (t: string) => {
      text.current = t
    },
    // Enter não tira o foco: com valor inválido, o campo fica aberto
    submitBehavior: 'submit' as const,
    ...(Platform.OS === 'web' ? { blurOnSubmit: false } : {}),
    onSubmitEditing: (e: { nativeEvent: unknown }) => {
      textOf(e)
      finish('submit')
    },
    onBlur: (e: { nativeEvent: unknown }) => {
      textOf(e)
      finish('leave')
    },
    onKeyPress: (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === 'Escape') cancel()
    },
  }
  return { valueId, start, inputProps }
}
