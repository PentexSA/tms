import { onlineManager } from '@tanstack/react-query'
import { BottomSheet, Button, Text } from '@tms/ui'
import { useState } from 'react'
import { useSession } from '../../lib/session/SessionProvider'
import { useOptionalSync } from '../../sheet/sync/SyncProvider'

// "Sair" (T-14; R-16 em parte). O logout apaga a fila do aparelho: o que não
// chegou ao servidor se perde. Antes, com rede, tenta enviar a fila; se
// ainda sobrar alteração, avisa e só sai com "Sair e descartar". Sem
// pendência, sai direto, como antes.
//
// Rascunhos persistidos (P03-C) entram na mesma conta quando existirem: o
// pacote do rascunho liga a contagem aqui.

/** Quanto tempo o envio da fila pode segurar o "Sair" antes de decidir. */
export const FLUSH_BEFORE_LOGOUT_MS = 3000

const pendingText = (count: number) =>
  count === 1
    ? '1 alteração ainda não foi enviada e será descartada neste aparelho.'
    : `${count} alterações ainda não foram enviadas e serão descartadas neste aparelho.`

export function LogoutButton() {
  const { session } = useSession()
  const sync = useOptionalSync()
  const [checking, setChecking] = useState(false)
  const [pending, setPending] = useState(0)

  const pendingNow = async () => {
    if (!sync) return 0
    if (onlineManager.isOnline()) {
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        sync.flush().catch(() => undefined),
        new Promise(resolve => {
          timer = setTimeout(resolve, FLUSH_BEFORE_LOGOUT_MS)
        }),
      ])
      clearTimeout(timer)
    }
    return sync.status.getSnapshot().pending
  }

  const onPress = async () => {
    setChecking(true)
    try {
      const count = await pendingNow()
      if (count > 0) setPending(count)
      else await session.logout()
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <Button
        title="Sair"
        variant="ghost"
        busy={checking}
        onPress={() => void onPress()}
      />
      <BottomSheet
        visible={pending > 0}
        title="Sair e descartar?"
        onClose={() => setPending(0)}
        footer={
          <>
            <Button
              title="Continuar conectado"
              variant="secondary"
              onPress={() => setPending(0)}
            />
            <Button
              title="Sair e descartar"
              variant="danger"
              onPress={() => {
                setPending(0)
                void session.logout()
              }}
            />
          </>
        }
      >
        <Text>{pendingText(pending)}</Text>
      </BottomSheet>
    </>
  )
}
