import { BottomSheet, Button, Text } from '@tms/ui'
import { usePreventRemove } from 'expo-router'
import { useState } from 'react'
import { useStore } from 'zustand'
import type { SheetStore } from '../store/sheetStore'
import { changesLabel } from './ModeBar'

// Sair da ficha com rascunho de Evoluir pede confirmação: o usePreventRemove
// segura a navegação (voltar, replace, gesto) e, no web, o `beforeunload` do
// navegador (recarregar, fechar a aba). O evento `beforeRemove` não existe
// mais na navegação do Expo Router 58: escutá-lo não segurava nada.

export function LeaveGuard({ store }: { readonly store: SheetStore }) {
  const count = useStore(store, s => s.draft?.size ?? 0)
  const [pending, setPending] = useState<{
    readonly count: number
    readonly leave: () => void
  } | null>(null)

  usePreventRemove(count > 0, ({ repeat }) => {
    setPending({
      count,
      leave: () => {
        store.getState().discardDraft()
        repeat()
      },
    })
  })

  return (
    <BottomSheet
      visible={pending !== null}
      title="Sair sem salvar?"
      onClose={() => setPending(null)}
      footer={
        <>
          <Button
            title="Continuar editando"
            variant="ghost"
            onPress={() => setPending(null)}
          />
          <Button
            title="Descartar e sair"
            variant="danger"
            onPress={() => {
              const leave = pending?.leave
              setPending(null)
              leave?.()
            }}
          />
        </>
      }
    >
      <Text>
        {pending?.count === 1
          ? '1 alteração da edição ainda não foi salva e será descartada.'
          : `${changesLabel(pending?.count ?? 0)} da edição ainda não foram salvas e serão descartadas.`}
      </Text>
    </BottomSheet>
  )
}
