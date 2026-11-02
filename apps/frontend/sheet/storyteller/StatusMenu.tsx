import { useQueryClient } from '@tanstack/react-query'
import type { SheetModel } from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  IconButton,
  Pressable,
  Text,
  tokens,
  useLayout,
  useTheme,
  useToast,
} from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { stateLabel } from '../../components/chronicles/tableItems'
import { api } from '../../lib/api'
import { messageOf } from '../../lib/errors'
import { chronicleKeys } from '../../lib/queries/chronicles'
import { useCompleteCreation } from '../../lib/queries/creation'
import { CompletionMessage } from '../creation/CompletionMessage'
import {
  completionCopy,
  isStaleCompletion,
  STALE_COMPLETION,
  unsavedBeforeCompleting,
} from '../creation/completion'
import {
  creationRefusalOf,
  errorBodyOf,
  REFUSAL_TEXT,
} from '../creation/creation'
import { sheetKeys } from '../data'
import { deadLabel } from '../policy'

// O menu ⋯ do narrador na ficha (doc/plano-v3.md, Etapa 6): concluir a
// criação, travar e destravar, arquivar, marcar com o rótulo de `dead` do
// template e reativar. Só as ações válidas no estado; o servidor confere de
// novo e grava cada uma no registro da crônica. Concluir, arquivar e `dead`
// pedem confirmação. Concluir (T-32) usa o mesmo texto da barra de Criação,
// manda a chave, a revisão e a versão da ficha, e não descarta em silêncio o
// rascunho aberto do narrador.

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
  // O título da folha de confirmação (sem ele, o rótulo) e o botão que
  // confirma (sem ele, o rótulo)
  readonly title?: string
  readonly confirmLabel?: string
  // O aviso depois de aplicar
  readonly done: string
}

/** As ações do narrador que o estado permite, na ordem do menu. */
export function statusActions(
  model: SheetModel,
  status: string,
  locked: boolean,
  // A crônica pede aprovação: o narrador conclui e aprova numa ação
  approval = false
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
    case 'creating': {
      const copy = completionCopy({
        by: 'storyteller',
        approval,
        action: 'complete',
      })
      return [
        {
          id: 'complete',
          label: 'Concluir criação',
          title: copy.title,
          confirm: copy.body,
          confirmLabel: copy.confirm,
          done: copy.done,
        },
        archive,
        markDead,
      ]
    }
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

async function run(
  characterId: string,
  action: Exclude<StatusActionId, 'complete'>
) {
  const character = api.characters({ id: characterId })
  switch (action) {
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

/** O que concluir pelo menu precisa saber da ficha aberta (T-32). */
export interface StatusMenuDraft {
  // A revisão da criação e a versão da ficha em cache: o servidor recusa
  // com 409 o que mudou desde então
  readonly revision?: number
  readonly sheetVersion?: number
  // Alterações não salvas do rascunho aberto: concluir fica desabilitado
  readonly unsaved?: number
  // A crônica pede aprovação
  readonly approval?: boolean
  // Linhas extras da confirmação (o P05-C põe a sobra de bônus, T-18)
  readonly notes?: readonly string[]
}

export function StatusMenuButton({
  characterId,
  chronicleId,
  model,
  status,
  locked,
  ...draft
}: {
  readonly characterId: string
  readonly chronicleId: string
  readonly model: SheetModel
  readonly status: string
  readonly locked: boolean
} & StatusMenuDraft) {
  const [open, setOpen] = useState(false)
  const { breakpoint } = useLayout()
  const actions = statusActions(model, status, locked, draft.approval)
  if (!actions.length) return null
  const state = stateLabel(model, status, locked)
  return (
    <>
      {breakpoint === 'compact' ? (
        <IconButton
          label="Ações do narrador"
          glyph="⋯"
          testID="status-menu"
          onPress={() => setOpen(true)}
        />
      ) : (
        // Na tela larga o ⋯ sozinho some entre "Experiência" e "Histórico":
        // o botão diz de quem são as ações e em que estado a ficha está
        <StatusMenuTrigger state={state} onPress={() => setOpen(true)} />
      )}
      {open ? (
        <StatusMenu
          characterId={characterId}
          chronicleId={chronicleId}
          actions={actions}
          draft={draft}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}

function StatusMenuTrigger({
  state,
  onPress,
}: {
  readonly state: string | null
  readonly onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      testID="status-menu"
      accessibilityRole="button"
      // O nome acessível começa pelo texto visível (WCAG 2.5.3)
      accessibilityLabel={state ? `Narrador, ${state}` : 'Narrador'}
      accessibilityHint="Abre as ações do narrador"
      onPress={onPress}
      style={[styles.trigger, { borderColor: colors.borderControl }]}
    >
      <Text variant="fieldLabel">Narrador</Text>
      {state ? (
        <View style={[styles.state, { borderColor: colors.action }]}>
          <Text variant="caption" color="action">
            {state}
          </Text>
        </View>
      ) : null}
      <Text variant="caption" color="inkMuted">
        ▾
      </Text>
    </Pressable>
  )
}

function StatusMenu({
  characterId,
  chronicleId,
  actions,
  draft,
  onClose,
}: {
  readonly characterId: string
  readonly chronicleId: string
  readonly actions: readonly StatusAction[]
  readonly draft: StatusMenuDraft
  readonly onClose: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const complete = useCompleteCreation(characterId, chronicleId)
  const [asking, setAsking] = useState<StatusAction | null>(null)
  const [busy, setBusy] = useState(false)
  const unsaved = draft.unsaved ?? 0

  const applied = (action: StatusAction) => {
    toast.show({ message: action.done })
    onClose()
    void queryClient.invalidateQueries({
      queryKey: sheetKeys.character(characterId),
    })
    void queryClient.invalidateQueries({
      queryKey: chronicleKeys.one(chronicleId),
    })
  }

  // Pela mesma mutação da barra: chave por intenção, revisão, versão e a
  // rebusca da ficha, da Mesa e da lista. O servidor decide; o cliente só
  // não conclui sobre dado velho
  const finish = async (action: StatusAction) => {
    try {
      await complete.mutateAsync({
        revision: draft.revision,
        sheetVersion: draft.sheetVersion,
      })
      applied(action)
    } catch (error) {
      const body = errorBodyOf(error)
      const code = creationRefusalOf(body)
      toast.show({
        message: isStaleCompletion(body)
          ? STALE_COMPLETION
          : code
            ? REFUSAL_TEXT[code]
            : messageOf(error, 'Não foi possível concluir a criação.'),
      })
    }
  }

  const apply = async (action: StatusAction) => {
    setBusy(true)
    try {
      if (action.id === 'complete') {
        await finish(action)
        return
      }
      const res = await run(characterId, action.id)
      if (res.error) {
        toast.show({
          message: messageOf(res.error, 'Não foi possível mudar a ficha.'),
        })
        return
      }
      applied(action)
    } finally {
      setBusy(false)
    }
  }

  if (asking) {
    // Concluir com o rascunho aberto descartaria as alterações em silêncio
    const blocked = asking.id === 'complete' && unsaved > 0
    return (
      <BottomSheet
        visible
        title={asking.title ?? asking.label}
        onClose={onClose}
        footer={
          <>
            <Button
              title="Voltar"
              variant="ghost"
              onPress={() => setAsking(null)}
            />
            <Button
              title={asking.confirmLabel ?? asking.label}
              testID={`status-${asking.id}-confirm`}
              busy={busy}
              disabled={busy || blocked}
              onPress={() => void apply(asking)}
            />
          </>
        }
      >
        {asking.id === 'complete' ? (
          <View style={styles.list}>
            {blocked ? (
              <Text color="danger" accessibilityRole="alert">
                {unsavedBeforeCompleting(unsaved)}
              </Text>
            ) : null}
            <CompletionMessage
              body={asking.confirm ?? ''}
              notes={draft.notes}
            />
          </View>
        ) : (
          <Text>{asking.confirm}</Text>
        )}
      </BottomSheet>
    )
  }

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
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.control,
    paddingHorizontal: tokens.space[3],
  },
  state: {
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.hair,
    paddingHorizontal: tokens.space[2],
  },
})
