import {
  Banner,
  BottomSheet,
  Button,
  Pressable,
  SectionHeader,
  Stepper,
  Text,
  TextField,
  tokens,
  useToast,
} from '@tms/ui'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import {
  useApproveCreation,
  useCompleteCreation,
  useReturnCreation,
  useSaveCreation,
} from '../../lib/queries/creation'
import { useSheet, useSheetSelector } from '../context'
import { useAnchor } from '../layouts/anchor'
import { CompletionMessage } from './CompletionMessage'
import { useCreation, useGuideNav } from './CreationContext'
import {
  completionBy,
  completionCopy,
  isStaleCompletion,
  STALE_COMPLETION,
} from './completion'
import {
  basicsDone,
  type CreationPhase,
  completeLabel,
  completionFreebies,
  creationRefusalOf,
  errorBodyOf,
  freebieLedger,
  freebiesBalance,
  freebiesNotes,
  REFUSAL_TEXT,
  restam,
} from './creation'
import { useGuideItems } from './GuideRow'
import { confirmNote, type GuideItem, useCreationNotices } from './guide'
import { CLOSED_COPY } from './nextStep'
import { RadioChips } from './RadioChips'

// O modo de criação (doc/plano-v4.md, Etapa 5). A distribuição fica na ficha;
// a conta (o que os pontos gastam, saldo de bônus, o que falta) fica na aba
// Pontos (CreationPanel), e a barra (ModeBar) tem "Salvar" sempre e, com
// a conta fechada, a conclusão ao lado (D-01). As prioridades ficam no
// cabeçalho de cada grupo (CreationCounter). Concluir exige rede, rascunho
// salvo e a fila confirmada: a conclusão nunca confirma escolhas ainda locais.

const PHASES: readonly {
  readonly id: CreationPhase
  readonly label: string
}[] = [
  { id: 'basics', label: 'Pontos básicos' },
  { id: 'freebies', label: 'Pontos de bônus' },
]

/** A criação por pontos em `creating`: a aba Pontos e o botão concluir. */
export function useCreating(): boolean {
  const creation = useCreation()
  return Boolean(
    creation?.active && creation.status === 'creating' && creation.info
  )
}

/** "Bônus: restam 10 de 15", para a barra; null sem bônus (T-18). */
export function useFreebiesText(): string | null {
  return useSheetSelector(s => freebiesBalance(s.check))
}

/**
 * A sobra de bônus nas confirmações de concluir e aprovar (T-18): "Sobram 4
 * pontos de bônus. Eles não viram XP.", só com a conta fechada. Concluir com
 * sobra continua permitido. O menu do narrador recebe o mesmo número pelo
 * onDraftState (SheetScreen), porque fica fora da ficha.
 */
export function useFreebiesNotes(): readonly string[] {
  const left = useSheetSelector(s => completionFreebies(s.check))
  // Os avisos que não bloqueiam (P05-D §3.9): uma linha, como a sobra
  const confirm = useCreationNotices().length
  return useMemo(() => {
    const note = confirmNote(confirm)
    return note ? [...freebiesNotes(left), note] : freebiesNotes(left)
  }, [left, confirm])
}

/**
 * A conclusão da barra de Criação (D-01: ao lado do "Salvar"). Com a conta
 * fechada (`ready`), `start` espera o rascunho salvo e a fila confirmada e só
 * então chama a API.
 * Mexer na ficha enquanto espera cancela a conclusão.
 */
export function useFinishCreation() {
  const creation = useCreation()
  const { roles, store } = useSheet()
  const creating = useCreating()
  const ready = useSheetSelector(s => s.check?.complete === true)
  const dirty = useSheetSelector(s => (s.draft?.size ?? 0) > 0)
  const queued = useSheetSelector(s => s.pending.length > 0)
  const notes = useFreebiesNotes()
  const toast = useToast()
  const complete = useCompleteCreation(
    creation?.characterId ?? '',
    creation?.chronicleId ?? ''
  )
  const [waiting, setWaiting] = useState(false)
  const info = creation?.info ?? null

  useEffect(() => {
    if (!waiting) return
    if (dirty) {
      setWaiting(false)
      return
    }
    if (queued) return
    setWaiting(false)
    const s = store.getState()
    // O servidor recusou o rascunho (ou houve conflito): a conta reabriu
    if (!info || s.conflict || !s.check?.complete) return
    complete.mutate(
      { revision: info.revision, sheetVersion: s.sheetVersion },
      {
        // O aviso de quem concluiu (T-32): o narrador lê "passa por você"
        onSuccess: result =>
          toast.show({
            message: completionCopy({
              by: completionBy(roles),
              approval: result.status === 'pending',
              action: 'complete',
            }).done,
          }),
        // Um pedido de ajuste no meio sobe a revisão (P04-D): a mesma
        // frase do menu do narrador, e a rebusca traz o banner do pedido
        onError: error => {
          const body = errorBodyOf(error)
          const code = creationRefusalOf(body)
          toast.show({
            message: isStaleCompletion(body)
              ? STALE_COMPLETION
              : code
                ? REFUSAL_TEXT[code]
                : messageOf(error, 'Não foi possível concluir a criação.'),
          })
        },
      }
    )
  }, [waiting, dirty, queued, info, store, complete, toast, roles])

  return {
    ready: creating && ready,
    label: info ? completeLabel(info, roles) : '',
    // A ficha vai para o narrador aprovar
    approval: info?.approval === true && !roles.has('storyteller'),
    // Linhas extras da confirmação: a sobra de bônus (T-18)
    notes,
    busy: waiting || complete.isPending,
    waitingSync: waiting && queued,
    start: () => setWaiting(true),
  }
}

/**
 * O aviso que fica na ficha em Criação: a última recusa da conta. A devolução
 * do narrador é o `ReturnedBanner`, que vale em qualquer modo (T-06).
 */
export function CreationAlerts() {
  const creation = useCreation()
  const refusal = useSheetSelector(s => s.creationRefusal)
  if (!creation?.active || creation.status !== 'creating' || !creation.info)
    return null
  if (!refusal) return null
  return (
    <View style={styles.panel}>
      <Banner
        tone="warning"
        message={`${REFUSAL_TEXT[refusal.code]} A alteração foi desfeita.`}
        testID="creation-refused"
      />
    </View>
  )
}

/** A aba Pontos: o que os pontos gastam, o saldo e o que falta. */
export function CreationPanel() {
  const creation = useCreation()
  const { roles, store, mode } = useSheet()
  const check = useSheetSelector(s => s.check)
  const phase = useSheetSelector(s => s.creationPhase)
  const missing = useGuideItems()
  const notices = useCreationNotices()
  // O "ir ao grupo" (P05-D): o painel e os blocos dele são âncoras
  const panel = useAnchor('creation-panel', { focusable: false })
  if (
    !creation?.active ||
    creation.status !== 'creating' ||
    !creation.info ||
    !check
  )
    return null
  const storyteller = roles.has('storyteller')
  const { freebies } = check

  return (
    <View
      style={styles.panel}
      testID="creation-panel"
      onLayout={panel.onLayout}
    >
      {freebies ? (
        <View style={styles.block}>
          <RadioChips
            label="O que os pontos gastam"
            options={PHASES}
            value={phase}
            onChange={id =>
              store.getState().setCreationPhase(id as CreationPhase)
            }
            testID="creation-phase"
          />
          <Text variant="caption" color="inkMuted">
            {phase === 'basics'
              ? 'Cada grupo trava quando os pontos básicos acabam. Depois, passe para os pontos de bônus.'
              : 'Passar dos pontos básicos de um grupo usa os pontos de bônus, até o saldo acabar.'}
          </Text>
        </View>
      ) : null}
      {freebies ? (
        <Text
          testID="creation-freebies"
          color={freebies.remaining < 0 ? 'danger' : 'ink'}
        >
          {freebies.remaining < 0
            ? `Bônus: ${-freebies.remaining} acima do saldo (${freebies.spent} de ${freebies.available + freebies.credit}).`
            : `${freebiesBalance(check)}.`}
        </Text>
      ) : null}
      <Ledger />
      {missing.length ? (
        <GuideList
          anchor="creation-missing"
          title="O que falta"
          label="O que falta na criação"
          items={missing}
          testID="creation-problems"
        />
      ) : (
        <Text variant="caption" color="inkMuted" testID="creation-ready">
          {freebies && freebies.remaining > 0
            ? `Pontos básicos completos; ${restam(freebies.remaining)} de bônus. Gaste-os nos grupos ou conclua pela barra de cima.`
            : 'A conta fechou: conclua a criação pela barra de cima.'}
        </Text>
      )}
      {notices.length ? (
        <GuideList
          anchor="creation-confirm"
          title="Para confirmar com o narrador"
          label="Para confirmar com o narrador"
          items={notices}
          testID="creation-notices"
        />
      ) : null}
      {/* As "Regras da casa" gravam: só na Criação, nunca na Leitura (T-33) */}
      {storyteller && mode === 'create' ? <BudgetControls /> : null}
    </View>
  )
}

/**
 * Uma lista do guia na aba Pontos: cada item é um botão que leva ao grupo
 * (P05-D, R-18). O que impede salvar fica em perigo, e o texto diz
 * "acima"; o "confirme com o narrador" (`confirm`) não impede nada.
 */
function GuideList({
  anchor,
  title,
  label,
  items,
  testID,
}: {
  readonly anchor: string
  readonly title: string
  readonly label: string
  readonly items: readonly GuideItem[]
  readonly testID: string
}) {
  const goTo = useGuideNav()
  const { onLayout, target } = useAnchor(anchor, { parent: 'creation-panel' })
  return (
    <View
      style={styles.block}
      accessibilityLabel={label}
      testID={testID}
      onLayout={onLayout}
    >
      <View {...target}>
        <SectionHeader title={title} level="group" />
      </View>
      {items.map(item => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityHint={goTo ? 'Vai ao grupo na ficha' : undefined}
          disabled={!goTo}
          onPress={() => goTo?.(item.target)}
          style={styles.item}
        >
          <Text
            variant="caption"
            color={item.kind === 'blocking' ? 'danger' : 'inkMuted'}
          >
            {item.text}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

/** "Onde foram os bônus" (R-17), logo abaixo do saldo. */
function Ledger() {
  const { model } = useSheet()
  const check = useSheetSelector(s => s.check)
  const { onLayout, target } = useAnchor('creation-ledger', {
    parent: 'creation-panel',
  })
  const ledger = freebieLedger(model, check)
  if (!ledger) return null
  return (
    <View
      style={styles.block}
      accessibilityLabel="Onde foram os bônus"
      testID="creation-ledger"
      onLayout={onLayout}
    >
      <View {...target}>
        <SectionHeader title="Onde foram os bônus" level="group" />
      </View>
      {ledger.entries.map(e => (
        <View key={e.key} style={styles.entry}>
          <Text variant="caption">{e.text}</Text>
          {e.detail ? (
            <Text variant="caption" color="inkMuted">
              {e.detail}
            </Text>
          ) : null}
        </View>
      ))}
      <Text variant="caption" color="inkMuted" testID="creation-ledger-total">
        {ledger.total}
      </Text>
    </View>
  )
}

/**
 * O aviso de que os pontos básicos acabaram: a distribuição passa a gastar
 * os pontos de bônus. Só na passagem (a ficha que já abre assim muda de fase
 * sem aviso) e uma vez por tela.
 */
export function BonusNotice({ onBudget }: { readonly onBudget: () => void }) {
  const { store } = useSheet()
  const creating = useCreating()
  const done = useSheetSelector(s => basicsDone(s.check))
  const closed = useSheetSelector(s => s.check?.complete === true)
  const remaining = useSheetSelector(s => s.check?.freebies?.remaining ?? 0)
  const [open, setOpen] = useState(false)
  const was = useRef<boolean | null>(null)
  const wasClosed = useRef<boolean | null>(null)
  const shown = useRef(false)

  useEffect(() => {
    if (!creating) return
    const before = was.current
    was.current = done
    const closedBefore = wasClosed.current
    wasClosed.current = closed
    let opened = false
    if (done && before !== true) {
      const s = store.getState()
      if (s.creationPhase === 'basics') s.setCreationPhase('freebies')
      // Já abriu com tudo distribuído: sem aviso
      if (before !== null && !shown.current) {
        shown.current = true
        opened = true
        setOpen(true)
        AccessibilityInfo.announceForAccessibility(
          'Pontos básicos distribuídos. Agora os pontos gastam bônus.'
        )
      }
    }
    // A conta fechou na tela (P05-D): um anúncio só, e nenhum quando a folha
    // abriu na mesma passagem, porque ela já anuncia
    if (closedBefore === false && closed && !opened)
      AccessibilityInfo.announceForAccessibility(CLOSED_COPY.announce)
  }, [creating, done, closed, store])

  return (
    <BottomSheet
      visible={open}
      title="Começaram os pontos de bônus"
      onClose={() => setOpen(false)}
      testID="bonus-notice"
      footer={
        <>
          <Button
            title="Ver Pontos"
            variant="ghost"
            onPress={() => {
              setOpen(false)
              onBudget()
            }}
          />
          <Button title="Entendi" onPress={() => setOpen(false)} />
        </>
      }
    >
      <Text>
        {`Os pontos básicos de todos os grupos foram distribuídos. A partir de agora, cada ponto a mais gasta os pontos de bônus: ${restam(remaining)}.`}
      </Text>
    </BottomSheet>
  )
}

/** Estado submetido: o dono aguarda; o narrador aprova ou devolve. */
export function CreationStatusPanel() {
  const creation = useCreation()
  const { roles } = useSheet()
  const toast = useToast()
  const approve = useApproveCreation(
    creation?.characterId ?? '',
    creation?.chronicleId ?? ''
  )
  const sendBack = useReturnCreation(
    creation?.characterId ?? '',
    creation?.chronicleId ?? ''
  )
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  // "Aprovar ficha" confirma antes, como concluir (T-32), com a sobra de
  // bônus (T-18)
  const [approving, setApproving] = useState(false)
  const approveNotes = useFreebiesNotes()
  // O painel continua montado fora de `pending`: sem zerar, o formulário de
  // devolução reaparecia preenchido na próxima revisão (nota do QA app)
  const pending = creation?.status === 'pending'
  useEffect(() => {
    if (pending) return
    setReturning(false)
    setReason('')
    setError(null)
    setApproving(false)
  }, [pending])
  if (!pending) return null
  const storyteller = roles.has('storyteller')

  const failed = (failure: unknown, fallback: string) => {
    const code = creationRefusalOf(errorBodyOf(failure))
    const text = code ? REFUSAL_TEXT[code] : messageOf(failure, fallback)
    setError(text)
    toast.show({ message: text })
  }

  return (
    <View style={styles.panel} testID="creation-pending">
      <Banner
        tone="warning"
        title="Aguardando aprovação"
        message={
          storyteller
            ? 'Confira a conta e a ficha antes de aprovar, ou devolva com o que precisa ser corrigido.'
            : 'A ficha aguarda aprovação do narrador. Enquanto isso, ela fica somente para leitura.'
        }
      />
      {error ? (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {storyteller ? (
        <View style={styles.block}>
          <View style={styles.actions}>
            <Button
              title="Aprovar ficha"
              testID="creation-approve"
              busy={approve.isPending}
              disabled={sendBack.isPending}
              onPress={() => {
                setError(null)
                setApproving(true)
              }}
            />
            <Button
              title={
                returning ? 'Cancelar devolução' : 'Devolver para correção'
              }
              variant="secondary"
              testID="creation-return-open"
              disabled={approve.isPending || sendBack.isPending}
              onPress={() => {
                setReturning(value => !value)
                setError(null)
              }}
            />
          </View>
          {returning ? (
            <View style={styles.block}>
              <TextField
                label="O que precisa ser corrigido"
                value={reason}
                maxLength={500}
                testID="creation-return-reason"
                onChangeText={setReason}
              />
              <Button
                title="Confirmar devolução"
                variant="danger"
                testID="creation-return"
                busy={sendBack.isPending}
                disabled={!reason.trim() || approve.isPending}
                onPress={() => {
                  setError(null)
                  sendBack.mutate(reason.trim(), {
                    onSuccess: () => {
                      setReturning(false)
                      setReason('')
                      toast.show({
                        message: 'Ficha devolvida para correção.',
                      })
                    },
                    onError: failure =>
                      failed(
                        failure,
                        'Não foi possível devolver a ficha para correção.'
                      ),
                  })
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {storyteller ? (
        <BottomSheet
          visible={approving}
          title={approveCopy.title}
          onClose={() => setApproving(false)}
          footer={
            <>
              <Button
                title="Voltar"
                variant="ghost"
                onPress={() => setApproving(false)}
              />
              <Button
                title={approveCopy.confirm}
                testID="creation-approve-confirm"
                busy={approve.isPending}
                onPress={() =>
                  approve.mutate(undefined, {
                    onSuccess: () => {
                      setApproving(false)
                      toast.show({ message: approveCopy.done })
                    },
                    onError: failure => {
                      setApproving(false)
                      failed(failure, 'Não foi possível aprovar a ficha.')
                    },
                  })
                }
              />
            </>
          }
        >
          <CompletionMessage body={approveCopy.body} notes={approveNotes} />
        </BottomSheet>
      ) : null}
    </View>
  )
}

const approveCopy = completionCopy({
  by: 'storyteller',
  approval: true,
  action: 'approve',
})

/** O narrador ajusta o saldo de bônus da ficha ou libera a criação livre. */
function BudgetControls() {
  const creation = useCreation()
  const toast = useToast()
  const save = useSaveCreation(creation?.characterId ?? '')
  const info = creation?.info
  const [freebies, setFreebies] = useState(info?.effective.freebies ?? 0)
  if (!info) return null
  const apply = (config: Record<string, unknown>, done: string) =>
    save.mutate(
      { revision: info.revision, config: { ...info.config, ...config } },
      {
        onSuccess: () => toast.show({ message: done }),
        onError: error => {
          const code = creationRefusalOf(errorBodyOf(error))
          toast.show({
            message: code
              ? REFUSAL_TEXT[code]
              : messageOf(error, 'Não foi possível ajustar a criação.'),
          })
        },
      }
    )
  return (
    <View style={styles.block} testID="creation-budget">
      <SectionHeader title="Regras da casa" level="group" />
      <Stepper
        label="Pontos de bônus desta ficha"
        showLabel
        value={freebies}
        min={0}
        max={1000}
        onChange={setFreebies}
      />
      <View style={styles.actions}>
        <Button
          title="Ajustar bônus"
          variant="secondary"
          disabled={save.isPending || freebies === info.effective.freebies}
          onPress={() => apply({ freebies }, 'Bônus da ficha ajustado.')}
        />
        <Button
          title="Liberar criação livre"
          variant="ghost"
          disabled={save.isPending}
          onPress={() =>
            apply(
              { mode: 'free' },
              'Criação livre: sem conta, e você conclui a ficha.'
            )
          }
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[4],
  },
  block: { gap: tokens.space[2] },
  entry: { gap: tokens.space['0.5'] },
  item: { justifyContent: 'center', alignItems: 'flex-start' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.space[2],
  },
})
