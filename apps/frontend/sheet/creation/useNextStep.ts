import { useToast } from '@tms/ui'
import { useEffect, useState } from 'react'

import { messageOf } from '../../lib/errors'
import { useReadyCreation } from '../../lib/queries/creation'
import { useSheet, useSheetSelector } from '../context'
import { useCreation } from './CreationContext'
import { isStaleCompletion } from './completion'
import { errorBodyOf } from './creation'
import { markerOf, nextStepCopy, READY_COPY, readerOf } from './nextStep'

export interface AnnounceReady {
  readonly label: string
  readonly busy: boolean
  // Esperando a fila confirmar o que foi salvo antes de avisar
  readonly waitingSync: boolean
  readonly start: () => void
}

/**
 * O próximo passo da barra (D-03, P04-D §3.3): a linha de texto e, na
 * criação livre, o "Avisar que terminei" do dono. Avisar segue o caminho de
 * concluir (useFinishCreation): `start` espera o rascunho salvo e a fila
 * confirmada e só então chama a API; mexer na ficha enquanto espera cancela.
 * O servidor confere papel, modo e estado de novo.
 */
export function useNextStep(): {
  readonly copy: string | null
  readonly announce: AnnounceReady | null
} {
  const creation = useCreation()
  const { roles, store } = useSheet()
  const dirty = useSheetSelector(s => (s.draft?.size ?? 0) > 0)
  const queued = useSheetSelector(s => s.pending.length > 0)
  const toast = useToast()
  const ready = useReadyCreation(
    creation?.characterId ?? '',
    creation?.chronicleId ?? ''
  )
  const [waiting, setWaiting] = useState(false)
  const info = creation?.info ?? null
  const creating = creation?.status === 'creating' && info !== null
  const by = readerOf(roles)

  useEffect(() => {
    if (!waiting) return
    if (dirty) {
      setWaiting(false)
      return
    }
    if (queued) return
    setWaiting(false)
    // O servidor recusou o rascunho (ou houve conflito): não avisa
    if (!info || store.getState().conflict) return
    ready.mutate(
      { revision: info.revision },
      {
        onSuccess: () => toast.show({ message: READY_COPY.done }),
        onError: error =>
          toast.show({
            message: isStaleCompletion(errorBodyOf(error))
              ? READY_COPY.stale
              : messageOf(error, 'Não foi possível avisar o narrador.'),
          }),
      }
    )
  }, [waiting, dirty, queued, info, store, ready, toast])

  if (!creating || !info) return { copy: null, announce: null }
  const copy = nextStepCopy({
    by,
    mode: info.mode,
    approval: info.approval,
    marker: markerOf(info),
  })
  // Só o dono jogador, na criação livre, antes de avisar
  const canAnnounce = by === 'owner' && info.mode === 'free' && !info.ready
  return {
    copy,
    announce: canAnnounce
      ? {
          label: READY_COPY.label,
          busy: waiting || ready.isPending,
          waitingSync: waiting && queued,
          start: () => setWaiting(true),
        }
      : null,
  }
}
