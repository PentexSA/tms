import { BottomSheet, Button, Text } from '@tms/ui'
import { usePreventRemove } from 'expo-router'
import { type ReactNode, type RefObject, useState } from 'react'

// Sair com alterações não salvas pede confirmação (T-56): a ficha em
// Criação/Editar, a Nova ficha e as regras da criação da crônica. O
// usePreventRemove segura a navegação (voltar, replace, gesto, o Voltar do
// Android) e, no web, o `beforeunload` do navegador (F5, fechar a aba). O
// evento `beforeRemove` não existe mais na navegação do Expo Router 58.

export interface UnsavedChangesGuardProps {
  // Há o que perder
  readonly when: boolean
  // O que se perde, numa frase
  readonly message: string
  // "Descartar e sair": desfaz antes de sair
  readonly onDiscard?: () => void
  // A saída já é o resultado de salvar (a ficha criada abre): passa direto
  readonly allowLeave?: RefObject<boolean>
  // Espaço para uma ação a mais na folha ("Salvar e sair", D-01)
  readonly extraAction?: ReactNode
}

export function UnsavedChangesGuard({
  when,
  message,
  onDiscard,
  allowLeave,
  extraAction,
}: UnsavedChangesGuardProps) {
  const [leave, setLeave] = useState<(() => void) | null>(null)

  usePreventRemove(when, ({ repeat }) => {
    if (allowLeave?.current) {
      repeat()
      return
    }
    setLeave(() => () => {
      onDiscard?.()
      repeat()
    })
  })

  return (
    <BottomSheet
      visible={leave !== null}
      title="Sair sem salvar?"
      onClose={() => setLeave(null)}
      footer={
        <>
          <Button
            title="Continuar editando"
            variant="ghost"
            onPress={() => setLeave(null)}
          />
          {extraAction}
          <Button
            title="Descartar e sair"
            variant="danger"
            onPress={() => {
              const go = leave
              setLeave(null)
              go?.()
            }}
          />
        </>
      }
    >
      <Text>{message}</Text>
    </BottomSheet>
  )
}
