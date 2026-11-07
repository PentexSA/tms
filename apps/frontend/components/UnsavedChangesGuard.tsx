import { BottomSheet, Button, Text, tokens, useLayout } from '@tms/ui'
import { usePreventRemove } from 'expo-router'
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

// Sair com alterações não salvas pede confirmação (T-56): a ficha em
// Criação/Editar, a Nova ficha e as regras da criação da crônica. O
// usePreventRemove segura a navegação (voltar, replace, gesto, o Voltar do
// Android) e, no web, o `beforeunload` do navegador (F5, fechar a aba). O
// evento `beforeRemove` não existe mais na navegação do Expo Router 58.
//
// A saída ("Descartar e sair", "Salvar e sair") acontece depois que a folha
// sai da tela (onClosed): no iOS, mexer na navegação enquanto um Modal
// ainda sai falha (a lição do P08 para a folha seguinte vale para sair).
// Enquanto ela sai, a tela continua segura: um segundo "voltar" não navega
// de novo (a saída combinada já vai navegar). Se o aviso de saída não vier,
// a saída acontece assim mesmo, depois de EXIT_FALLBACK_MS.
//
// Toda saída liberada (o `repeat`) desliga a prevenção no mesmo handler
// (`released`): com a tela ainda montada durante a animação de saída, o
// `when` do pai pode seguir verdadeiro (a ficha recém-criada, o "Salvar e
// sair" que ainda grava), e o usePreventRemove avisaria que o estado e a
// prop ficaram fora de sincronia.

/** Teto para esperar a folha sair (a animação leva ~300 ms). */
export const EXIT_FALLBACK_MS = 2000

export type SaveBeforeLeave =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string }

export interface UnsavedChangesGuardProps {
  // Há o que perder
  readonly when: boolean
  // O que se perde, numa frase
  readonly message: string
  // "Descartar e sair": desfaz antes de sair
  readonly onDiscard?: () => void
  // A saída já é o resultado de salvar (a ficha criada abre): passa direto
  readonly allowLeave?: RefObject<boolean>
  // "Salvar e sair" (D-01): grava e então sai. Recusado, a folha fica aberta
  // com a frase, e nada sai (fail secure). Sem ele, a folha tem duas ações
  readonly onSave?: () => SaveBeforeLeave
  readonly saveLabel?: string
}

export function UnsavedChangesGuard({
  when,
  message,
  onDiscard,
  allowLeave,
  onSave,
  saveLabel = 'Salvar e sair',
}: UnsavedChangesGuardProps) {
  // A navegação segurada; null com a folha fechada
  const [held, setHeld] = useState<(() => void) | null>(null)
  const [error, setError] = useState<string | null>(null)
  // A saída combinada, feita quando a folha termina de sair
  const exit = useRef<(() => void) | null>(null)
  // Saindo: a folha fecha e a saída espera por ela
  const [leaving, setLeaving] = useState(false)
  // A saída foi liberada: a prevenção desliga junto com o `repeat`
  const [released, setReleased] = useState(false)
  // Dois toques no mesmo quadro gravam uma vez só
  const saving = useRef(false)
  const { breakpoint, stacked } = useLayout()
  const column = breakpoint === 'compact' || stacked

  // Sem nada a perder, a próxima alteração volta a proteger a tela
  useEffect(() => {
    if (!when && !leaving) setReleased(false)
  }, [when, leaving])

  usePreventRemove((when || leaving) && !released, ({ repeat }) => {
    // Outro "voltar" enquanto a folha sai: a saída combinada já navega
    if (exit.current) return
    if (allowLeave?.current) {
      setReleased(true)
      repeat()
      return
    }
    exit.current = null
    saving.current = false
    setError(null)
    setHeld(() => repeat)
  })

  const stay = () => {
    setHeld(null)
    setError(null)
  }
  // Fecha a folha; a navegação segurada volta no onClosed
  const leaveAfterClose = (repeat: () => void) => {
    exit.current = repeat
    setLeaving(true)
    setHeld(null)
  }
  const discard = () => {
    if (!held) return
    onDiscard?.()
    leaveAfterClose(held)
  }
  const save = () => {
    if (!held || !onSave || saving.current) return
    saving.current = true
    let result: SaveBeforeLeave
    try {
      result = onSave()
    } catch {
      // Fail secure: fica na tela, com o rascunho, e o botão volta a valer
      result = { ok: false, message: 'Não foi possível salvar.' }
    }
    if (!result.ok) {
      saving.current = false
      setError(result.message)
      return
    }
    leaveAfterClose(held)
  }
  const closed = useCallback(() => {
    const go = exit.current
    exit.current = null
    saving.current = false
    if (!go) return
    // A prevenção desliga junto com a saída (o repeat também a desliga)
    setReleased(true)
    setLeaving(false)
    go()
  }, [])
  // Sem o aviso de que a folha saiu, sai assim mesmo
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(closed, EXIT_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [leaving, closed])
  // A tela saiu por outro caminho: nada a repetir
  useEffect(
    () => () => {
      exit.current = null
    },
    []
  )

  const discardButton = (
    <Button title="Descartar e sair" variant="danger" onPress={discard} />
  )
  const stayButton = (
    <Button title="Continuar editando" variant="ghost" onPress={stay} />
  )
  return (
    <BottomSheet
      visible={held !== null}
      title="Sair sem salvar?"
      onClose={stay}
      onClosed={closed}
      footer={
        !onSave ? (
          <>
            {stayButton}
            {discardButton}
          </>
        ) : column ? (
          // No celular, em coluna: a principal embaixo, perto do polegar e
          // longe da destrutiva (T-78), na mesma ordem do DOM da linha
          <View testID="leave-actions" style={styles.column}>
            {discardButton}
            {stayButton}
            <Button title={saveLabel} onPress={save} />
          </View>
        ) : (
          <View testID="leave-actions" style={styles.row}>
            <View style={styles.discard}>{discardButton}</View>
            {stayButton}
            <Button title={saveLabel} onPress={save} />
          </View>
        )
      }
    >
      <View style={styles.body}>
        {error ? (
          <Text color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Text>{message}</Text>
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: tokens.space[2] },
  column: { flex: 1, gap: tokens.space[2] },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
  },
  // Como o "Descartar" do resumo (T-78): à esquerda, longe da principal
  discard: { flex: 1, alignItems: 'flex-start' },
})
