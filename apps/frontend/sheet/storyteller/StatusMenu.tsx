import { useQueryClient } from '@tanstack/react-query'
import type { SheetModel } from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  IconButton,
  Text,
  tokens,
  useToast,
} from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { api } from '../../lib/api'
import { messageOf } from '../../lib/errors'
import { chronicleKeys } from '../../lib/queries/chronicles'
import { sheetKeys } from '../data'
import { deadLabel } from '../policy'

// O menu ⋯ do narrador na ficha (doc/plano-v3.md, Etapa 6): concluir a
// criação, travar e destravar, arquivar, marcar com o rótulo de `dead` do
// template e reativar. Só as ações válidas no estado; o servidor confere de
// novo e grava cada uma no registro da crônica. Arquivar e `dead` pedem
// confirmação.

export type StatusActionId =
  | 'complete'
  | 'lock'
  | 'unlock'
  | 'archive'
  | 'dead'
  | 'reactivate'

export interface StatusAction {
  readonly id: StatusActionId
  readonly label: string
  // A pergunta antes de aplicar; sem ela, aplica no toque
  readonly confirm?: string
  // O aviso depois de aplicar
  readonly done: string
}

/** As ações do narrador que o estado permite, na ordem do menu. */
export function statusActions(
  model: SheetModel,
  status: string,
  locked: boolean
): StatusAction[] {
  const dead = deadLabel(model)
  const keepsReading = 'O jogador continua lendo, mas só você muda a ficha.'
  const archive: StatusAction = {
    id: 'archive',
    label: 'Arquivar',
    confirm: `Arquivar a ficha? ${keepsReading}`,
    done: 'Ficha arquivada.',
  }
  const markDead: StatusAction = {
    id: 'dead',
    label: `Marcar como ${dead}`,
    confirm: `Marcar a ficha como ${dead}? ${keepsReading}`,
    done: `Ficha marcada como ${dead}.`,
  }
  const reactivate: StatusAction = {
    id: 'reactivate',
    label: 'Reativar',
    done: 'Ficha reativada.',
  }
  switch (status) {
    case 'creating':
      return [
        {
          id: 'complete',
          label: 'Concluir criação',
          done: 'Criação concluída. Subir um traço agora passa por você.',
        },
        archive,
        markDead,
      ]
    case 'active':
      return [
        locked
          ? { id: 'unlock', label: 'Destravar', done: 'Ficha destravada.' }
          : { id: 'lock', label: 'Travar', done: 'Ficha travada.' },
        archive,
        markDead,
      ]
    case 'archived':
      return [reactivate, markDead]
    case 'dead':
      return [reactivate, archive]
    default:
      return []
  }
}

async function run(characterId: string, action: StatusActionId) {
  const character = api.characters({ id: characterId })
  switch (action) {
    case 'complete':
      return character.creation.complete.post()
    case 'lock':
      return character.lock.post()
    case 'unlock':
      return character.lock.delete()
    case 'archive':
      return character.status.post({ status: 'archived' })
    case 'dead':
      return character.status.post({ status: 'dead' })
    case 'reactivate':
      return character.status.post({ status: 'active' })
  }
}

export function StatusMenuButton({
  characterId,
  chronicleId,
  model,
  status,
  locked,
}: {
  readonly characterId: string
  readonly chronicleId: string
  readonly model: SheetModel
  readonly status: string
  readonly locked: boolean
}) {
  const [open, setOpen] = useState(false)
  const actions = statusActions(model, status, locked)
  if (!actions.length) return null
  return (
    <>
      <IconButton
        label="Ações do narrador"
        glyph="⋯"
        testID="status-menu"
        onPress={() => setOpen(true)}
      />
      {open ? (
        <StatusMenu
          characterId={characterId}
          chronicleId={chronicleId}
          actions={actions}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function StatusMenu({
  characterId,
  chronicleId,
  actions,
  onClose,
}: {
  readonly characterId: string
  readonly chronicleId: string
  readonly actions: readonly StatusAction[]
  readonly onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [asking, setAsking] = useState<StatusAction | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = async (action: StatusAction) => {
    setBusy(true)
    try {
      const res = await run(characterId, action.id)
      if (res.error) {
        toast.show({
          message: messageOf(res.error, 'Não foi possível mudar a ficha.'),
        })
        return
      }
      toast.show({ message: action.done })
      onClose()
      void queryClient.invalidateQueries({
        queryKey: sheetKeys.character(characterId),
      })
      void queryClient.invalidateQueries({
        queryKey: chronicleKeys.one(chronicleId),
      })
    } finally {
      setBusy(false)
    }
  }

  if (asking)
    return (
      <BottomSheet
        visible
        title={asking.label}
        onClose={onClose}
        footer={
          <>
            <Button
              title="Voltar"
              variant="ghost"
              onPress={() => setAsking(null)}
            />
            <Button
              title={asking.label}
              disabled={busy}
              onPress={() => void apply(asking)}
            />
          </>
        }
      >
        <Text>{asking.confirm}</Text>
      </BottomSheet>
    )

  return (
    <BottomSheet visible title="Ações do narrador" onClose={onClose}>
      <View style={styles.list}>
        {actions.map(action => (
          <Button
            key={action.id}
            title={action.label}
            variant="secondary"
            disabled={busy}
            testID={`status-${action.id}`}
            onPress={() =>
              action.confirm ? setAsking(action) : void apply(action)
            }
          />
        ))}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  list: { gap: tokens.space[2] },
})
