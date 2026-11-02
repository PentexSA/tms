import { onlineManager } from '@tanstack/react-query'
import { BottomSheet, Button, Text } from '@tms/ui'
import { useState } from 'react'
import { useSession } from '../../lib/session/SessionProvider'
import { useLocalChanges, useOptionalSync } from '../../sheet/sync/SyncProvider'

// "Sair" (T-14; R-16 em parte). O logout apaga a fila do aparelho: o que não
// chegou ao servidor se perde. Antes, com rede, tenta enviar a fila; se
// ainda sobrar alteração, avisa e só sai com "Sair e descartar". Sem
// pendência, sai direto, como antes.
//
// Os rascunhos de Criação/Editar guardados no aparelho (P03-C, T-03) entram
// na mesma conta (useLocalChanges): o logout também os apaga. O aviso diz o
// que se perde, sem nenhum valor de campo.

/** Quanto tempo o envio da fila pode segurar o "Sair" antes de decidir. */
export const FLUSH_BEFORE_LOGOUT_MS = 3000

const pendingText = (count: number) =>
  count === 1
    ? '1 alteração ainda não foi enviada e será descartada neste aparelho.'
    : `${count} alterações ainda não foram enviadas e serão descartadas neste aparelho.`

const draftsText = (count: number) =>
  count === 1
    ? 'O rascunho não salvo de 1 ficha será descartado neste aparelho.'
    : `Os rascunhos não salvos de ${count} fichas serão descartados neste aparelho.`

interface Lost {
  readonly pending: number
  readonly drafts: number
}

const NONE: Lost = { pending: 0, drafts: 0 }

/** O que o logout descarta, numa ou duas frases. */
export const lostText = ({ pending, drafts }: Lost): string =>
  [pending ? pendingText(pending) : null, drafts ? draftsText(drafts) : null]
    .filter(Boolean)
    .join(' ')

export function LogoutButton() {
  const { session } = useSession()
  const sync = useOptionalSync()
  const local = useLocalChanges()
  const [checking, setChecking] = useState(false)
  const [lost, setLost] = useState<Lost>(NONE)

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

  // Os rascunhos: relidos do disco na hora, além da contagem viva
  const draftsNow = async () => {
    if (!sync) return local.drafts
    try {
      return (await sync.drafts.characters()).length
    } catch {
      return local.drafts
    }
  }

  const onPress = async () => {
    setChecking(true)
    try {
      const now = { pending: await pendingNow(), drafts: await draftsNow() }
      if (now.pending > 0 || now.drafts > 0) setLost(now)
      else await session.logout()
    } finally {
      setChecking(false)
    }
  }
  const asking = lost.pending > 0 || lost.drafts > 0

  return (
    <>
      <Button
        title="Sair"
        variant="ghost"
        busy={checking}
        onPress={() => void onPress()}
      />
      <BottomSheet
        visible={asking}
        title="Sair e descartar?"
        onClose={() => setLost(NONE)}
        footer={
          <>
            <Button
              title="Continuar conectado"
              variant="secondary"
              onPress={() => setLost(NONE)}
            />
            <Button
              title="Sair e descartar"
              variant="danger"
              onPress={() => {
                setLost(NONE)
                void session.logout()
              }}
            />
          </>
        }
      >
        <Text>{lostText(lost)}</Text>
      </BottomSheet>
    </>
  )
}
