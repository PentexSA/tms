import { useQueryClient } from '@tanstack/react-query'
import { RETURN_REASON_MAX, type SheetModel } from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  Pressable,
  Text,
  TextField,
  tokens,
  useTheme,
  useToast,
} from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { CharacterState } from '../../components/chronicles/characterState'
import { api } from '../../lib/api'
import { messageOf, statusOf } from '../../lib/errors'
import { chronicleKeys } from '../../lib/queries/chronicles'
import {
  useAdjustCreation,
  useCompleteCreation,
} from '../../lib/queries/creation'
import { CompletionMessage } from '../creation/CompletionMessage'
import {
  completionCopy,
  isStaleCompletion,
  QUEUED_BEFORE_COMPLETING,
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
// criação, pedir ajuste (D-04, P04-D), travar e destravar, arquivar, marcar
// com o rótulo de `dead` do template e reativar. Só as ações válidas no estado; o servidor confere de
// novo e grava cada uma no registro da crônica. Concluir, arquivar e `dead`
// pedem confirmação. Concluir (T-32) usa o mesmo texto da barra de Criação,
// manda a chave, a revisão e a versão da ficha, e não descarta em silêncio o
// rascunho aberto do narrador.

export type StatusActionId =
  | 'complete'
  | 'adjust'
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
  approval = false,
  // A ficha aceita pedido de ajuste: PC de outra pessoa (o servidor recusa
  // o NPC e a ficha do próprio narrador)
  adjustable = false
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
        ...(adjustable ? [ADJUST] : []),
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

/** D-04: o pedido de ajuste, com motivo, em qualquer ficha em criação. */
const ADJUST: StatusAction = {
  id: 'adjust',
  label: 'Pedir ajuste',
  confirm:
    'O jogador vê o motivo na ficha, como numa devolução. A ficha continua em criação.',
  done: 'Ajuste pedido. O jogador vê o motivo na ficha.',
}

export const ADJUST_INVALID =
  'Escreva o que precisa ser ajustado (até 500 caracteres, sem < nem >).'
export const STALE_ADJUST =
  'A ficha mudou desde que você abriu. Confira e peça de novo.'

async function run(
  characterId: string,
  action: Exclude<StatusActionId, 'complete' | 'adjust'>
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
  // Alterações não salvas do rascunho aberto e lotes ainda na fila:
  // concluir fica desabilitado (a barra também espera a fila)
  readonly unsaved?: number
  readonly queued?: number
  // A crônica pede aprovação
  readonly approval?: boolean
  // Linhas extras da confirmação: a sobra de bônus (T-18)
  readonly notes?: readonly string[]
}

/** De qual ficha são as ações do narrador. */
export interface StatusMenuTarget {
  readonly characterId: string
  readonly chronicleId: string
  readonly model: SheetModel
  readonly status: string
  readonly locked: boolean
  // O estado da ficha (D-02), sem "Concluída em": o mesmo da lista e da Mesa
  readonly state: CharacterState | null
  // PC de outra pessoa: o narrador pode pedir ajuste (D-04). É UX: o
  // servidor recusa o NPC e a ficha própria
  readonly adjustable?: boolean
}

/** O botão largo: a ficha e o rascunho aberto. */
export interface StatusMenuButtonProps
  extends StatusMenuTarget,
    StatusMenuDraft {}

/**
 * O gatilho do menu na tela larga (≥ 900). Abaixo disso, as ações ficam no
 * "Mais opções" da ficha (SheetMenu, T-11), com o estado no item. O botão
 * diz de quem são as ações e em que estado a ficha está.
 */
export function StatusMenuButton({
  characterId,
  chronicleId,
  model,
  status,
  locked,
  state,
  adjustable,
  ...draft
}: StatusMenuButtonProps) {
  const [open, setOpen] = useState(false)
  const actions = statusActions(
    model,
    status,
    locked,
    draft.approval,
    adjustable
  )
  if (!actions.length) return null
  return (
    <>
      <StatusMenuTrigger
        state={state?.label ?? null}
        onPress={() => setOpen(true)}
      />
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

export function StatusMenu({
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
  const adjust = useAdjustCreation(characterId, chronicleId)
  const [asking, setAsking] = useState<StatusAction | null>(null)
  const [busy, setBusy] = useState(false)
  // O motivo do pedido de ajuste e o erro dele, na própria folha
  const [reason, setReason] = useState('')
  const [invalid, setInvalid] = useState<string | null>(null)
  const unsaved = draft.unsaved ?? 0
  const queued = draft.queued ?? 0

  // `refresh: false` quando a mutação já rebuscou (concluir)
  const applied = (action: StatusAction, refresh = true) => {
    toast.show({ message: action.done })
    onClose()
    if (!refresh) return
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
      // A mutação já rebuscou a ficha, a Mesa e a lista
      applied(action, false)
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

  // D-04: o motivo aparado; o 422 fica na folha com o texto, o 409 rebusca
  // (a mutação já rebusca a ficha, a Mesa e a lista)
  const askAdjust = async (action: StatusAction, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setInvalid(null)
    try {
      await adjust.mutateAsync({ reason: trimmed, revision: draft.revision })
      applied(action, false)
    } catch (error) {
      const status = statusOf(error)
      if (status === 422) setInvalid(ADJUST_INVALID)
      else if (status === 409) {
        toast.show({ message: STALE_ADJUST })
        onClose()
      } else setInvalid(messageOf(error, 'Não foi possível pedir o ajuste.'))
    }
  }

  const apply = async (action: StatusAction, text = reason) => {
    setBusy(true)
    try {
      if (action.id === 'complete') {
        await finish(action)
        return
      }
      if (action.id === 'adjust') {
        await askAdjust(action, text)
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
    // Concluir com o rascunho aberto descartaria as alterações em silêncio;
    // com lotes na fila, concluiria sobre uma versão que ainda vai mudar
    const waiting =
      asking.id !== 'complete'
        ? null
        : unsaved > 0
          ? unsavedBeforeCompleting(unsaved)
          : queued > 0
            ? QUEUED_BEFORE_COMPLETING
            : null
    const blocked = waiting !== null
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
              disabled={
                busy || blocked || (asking.id === 'adjust' && !reason.trim())
              }
              onPress={() => void apply(asking)}
            />
          </>
        }
      >
        {asking.id === 'complete' ? (
          <View style={styles.list}>
            {waiting ? (
              <Text color="danger" accessibilityRole="alert">
                {waiting}
              </Text>
            ) : null}
            <CompletionMessage
              body={asking.confirm ?? ''}
              notes={draft.notes}
            />
          </View>
        ) : asking.id === 'adjust' ? (
          <View style={styles.list}>
            <Text>{asking.confirm}</Text>
            <TextField
              label="O que precisa ser ajustado"
              value={reason}
              maxLength={RETURN_REASON_MAX}
              autoFocus
              returnKeyType="send"
              testID="status-adjust-reason"
              onChangeText={text => {
                setReason(text)
                setInvalid(null)
              }}
              // O "✓" chega antes do último onChangeText (e0a4078): envia o
              // texto do evento
              onSubmitEditing={e => {
                const text = e.nativeEvent.text
                setReason(text)
                if (!busy && text.trim()) void apply(asking, text)
              }}
            />
            {invalid ? (
              <Text color="danger" accessibilityRole="alert">
                {invalid}
              </Text>
            ) : null}
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
