import { BottomSheet, Button, Text } from '@tms/ui'
import { useNavigation } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import type { SheetStore } from '../store/sheetStore'
import { changesLabel } from './ModeBar'

// Sair da ficha com rascunho de Evoluir pede confirmação: o `beforeRemove`
// da navegação (voltar, replace, gesto) e, no web, o `beforeunload` do
// navegador (recarregar, fechar a aba).

interface BeforeRemoveEvent {
  preventDefault(): void
  readonly data: { readonly action: unknown }
}

interface Navigation {
  addListener?(
    event: 'beforeRemove',
    cb: (e: BeforeRemoveEvent) => void
  ): () => void
  dispatch?(action: unknown): void
}

// O app não carrega a lib DOM do TypeScript: só o que o web usa aqui
interface UnloadEvent {
  preventDefault(): void
  returnValue: unknown
}
interface WebWindow {
  addEventListener(type: 'beforeunload', cb: (e: UnloadEvent) => void): void
  removeEventListener(type: 'beforeunload', cb: (e: UnloadEvent) => void): void
}

export function LeaveGuard({ store }: { readonly store: SheetStore }) {
  const navigation = useNavigation() as unknown as Navigation | undefined
  const [pending, setPending] = useState<{
    readonly count: number
    readonly leave: () => void
  } | null>(null)
  const nav = useRef(navigation)
  nav.current = navigation

  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('beforeRemove', e => {
      const count = store.getState().draft?.size ?? 0
      if (!count) return
      e.preventDefault()
      setPending({
        count,
        leave: () => {
          store.getState().discardDraft()
          nav.current?.dispatch?.(e.data.action)
        },
      })
    })
    return unsubscribe
  }, [navigation, store])

  useEffect(() => {
    const win = (globalThis as { window?: WebWindow }).window
    if (Platform.OS !== 'web' || !win) return
    const handler = (e: UnloadEvent) => {
      if (!store.getState().draft?.size) return
      e.preventDefault()
      // Navegadores antigos só mostram o aviso com returnValue preenchido
      e.returnValue = ''
    }
    win.addEventListener('beforeunload', handler)
    return () => win.removeEventListener('beforeunload', handler)
  }, [store])

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
          ? '1 alteração de Evoluir ainda não foi salva e será descartada.'
          : `${changesLabel(pending?.count ?? 0)} de Evoluir ainda não foram salvas e serão descartadas.`}
      </Text>
    </BottomSheet>
  )
}
