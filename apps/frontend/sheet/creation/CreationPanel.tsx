import {
  Banner,
  BottomSheet,
  Button,
  SectionHeader,
  Stepper,
  Text,
  TextField,
  tokens,
  useToast,
} from '@tms/ui'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import {
  useApproveCreation,
  useCompleteCreation,
  useReturnCreation,
  useSaveCreation,
} from '../../lib/queries/creation'
import { useSheet, useSheetSelector } from '../context'
import { useCreation } from './CreationContext'
import {
  basicsDone,
  type CreationPhase,
  completeLabel,
  creationRefusalOf,
  errorBodyOf,
  problemText,
  REFUSAL_TEXT,
} from './creation'
import { RadioChips } from './RadioChips'

// O modo de criação (doc/plano-v4.md, Etapa 5). A distribuição fica na ficha;
// a conta (o que os pontos gastam, saldo de bônus, o que falta) fica na aba
// Orçamento (CreationPanel), e o botão único da barra (ModeBar) salva o
// rascunho ou, com a conta fechada, conclui. As prioridades ficam no
// cabeçalho de cada grupo (CreationCounter). Concluir exige rede, rascunho
// salvo e a fila confirmada: a conclusão nunca confirma escolhas ainda locais.

const PHASES: readonly {
  readonly id: CreationPhase
  readonly label: string
}[] = [
  { id: 'basics', label: 'Pontos básicos' },
  { id: 'freebies', label: 'Pontos de bônus' },
]

/** A criação por pontos em `creating`: a aba Orçamento e o botão concluir. */
export function useCreating(): boolean {
  const creation = useCreation()
  return Boolean(
    creation?.active && creation.status === 'creating' && creation.info
  )
}

/** "Bônus: 10 de 15", para a barra; null sem bônus. */
export function useFreebiesText(): string | null {
  return useSheetSelector(s => {
    const f = s.check?.freebies
    if (!f) return null
    const total = f.available + f.credit
    return f.remaining < 0
      ? `Bônus: ${-f.remaining} acima`
      : `Bônus: ${f.remaining} de ${total}`
  })
}

/**
 * O botão único da criação. Com a conta fechada (`ready`), ele conclui:
 * `start` espera o rascunho salvo e a fila confirmada e só então chama a API.
 * Mexer na ficha enquanto espera cancela a conclusão.
 */
export function useFinishCreation() {
  const creation = useCreation()
  const { roles, store } = useSheet()
  const creating = useCreating()
  const ready = useSheetSelector(s => s.check?.complete === true)
  const dirty = useSheetSelector(s => (s.draft?.size ?? 0) > 0)
  const queued = useSheetSelector(s => s.pending.length > 0)
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
        onSuccess: result =>
          toast.show({
            message:
              result.status === 'pending'
                ? 'Ficha enviada. Ela aguarda a aprovação do narrador.'
                : 'Criação concluída. Subir um traço agora passa pelo narrador.',
          }),
        onError: error => {
          const code = creationRefusalOf(errorBodyOf(error))
          toast.show({
            message: code
              ? REFUSAL_TEXT[code]
              : messageOf(error, 'Não foi possível concluir a criação.'),
          })
        },
      }
    )
  }, [waiting, dirty, queued, info, store, complete, toast])

  return {
    ready: creating && ready,
    label: info ? completeLabel(info, roles) : '',
    // A ficha vai para o narrador aprovar
    approval: info?.approval === true && !roles.has('storyteller'),
    busy: waiting || complete.isPending,
    waitingSync: waiting && queued,
    start: () => setWaiting(true),
  }
}

/** Os avisos que ficam na ficha: a devolução do narrador e a última recusa. */
export function CreationAlerts() {
  const creation = useCreation()
  const refusal = useSheetSelector(s => s.creationRefusal)
  if (!creation?.active || creation.status !== 'creating' || !creation.info)
    return null
  const { returned } = creation.info
  if (!returned && !refusal) return null
  return (
    <View style={styles.panel}>
      {returned ? (
        <Banner
          tone="warning"
          title="O narrador devolveu a ficha"
          message={returned.reason}
          testID="creation-returned"
        />
      ) : null}
      {refusal ? (
        <Banner
          tone="warning"
          message={`${REFUSAL_TEXT[refusal.code]} A alteração foi desfeita.`}
          testID="creation-refused"
        />
      ) : null}
    </View>
  )
}

/** A aba Orçamento: o que os pontos gastam, o saldo e o que falta. */
export function CreationPanel() {
  const creation = useCreation()
  const { model, roles, store } = useSheet()
  const check = useSheetSelector(s => s.check)
  const phase = useSheetSelector(s => s.creationPhase)
  if (
    !creation?.active ||
    creation.status !== 'creating' ||
    !creation.info ||
    !check
  )
    return null
  const storyteller = roles.has('storyteller')
  const { problems, freebies } = check

  return (
    <View style={styles.panel} testID="creation-panel">
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
              : 'Passar do orçamento de um grupo usa os pontos de bônus, até o saldo acabar.'}
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
            : `Bônus: ${freebies.remaining} de ${freebies.available + freebies.credit} restantes.`}
        </Text>
      ) : null}
      {problems.length ? (
        <View
          style={styles.block}
          accessibilityLabel="O que falta na criação"
          testID="creation-problems"
        >
          <SectionHeader title="O que falta" level="group" />
          {problems.slice(0, 12).map(p => (
            <Text
              key={`${p.code}:${p.budget ?? ''}:${p.group ?? ''}:${p.paths.join(',')}`}
              variant="caption"
              color={p.severity === 'blocking' ? 'danger' : 'inkMuted'}
            >
              {problemText(model, check, p)}
            </Text>
          ))}
        </View>
      ) : (
        <Text variant="caption" color="inkMuted" testID="creation-ready">
          A conta fechou: conclua a criação pela barra de cima.
        </Text>
      )}
      {storyteller ? <BudgetControls /> : null}
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
  const remaining = useSheetSelector(s => s.check?.freebies?.remaining ?? 0)
  const [open, setOpen] = useState(false)
  const was = useRef<boolean | null>(null)
  const shown = useRef(false)

  useEffect(() => {
    if (!creating) return
    const before = was.current
    was.current = done
    if (!done || before === true) return
    const s = store.getState()
    if (s.creationPhase === 'basics') s.setCreationPhase('freebies')
    // Já abriu com tudo distribuído: sem aviso
    if (before === null || shown.current) return
    shown.current = true
    setOpen(true)
    AccessibilityInfo.announceForAccessibility(
      'Pontos básicos distribuídos. Agora os pontos gastam bônus.'
    )
  }, [creating, done, store])

  return (
    <BottomSheet
      visible={open}
      title="Começaram os pontos de bônus"
      onClose={() => setOpen(false)}
      testID="bonus-notice"
      footer={
        <>
          <Button
            title="Ver orçamento"
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
        {`Os pontos básicos de todos os grupos foram distribuídos. A partir de agora, cada ponto a mais gasta os pontos de bônus: ${remaining === 1 ? 'resta 1' : `restam ${remaining}`}.`}
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
  if (creation?.status !== 'pending') return null
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
                approve.mutate(undefined, {
                  onSuccess: () =>
                    toast.show({ message: 'Ficha aprovada e liberada.' }),
                  onError: failure =>
                    failed(failure, 'Não foi possível aprovar a ficha.'),
                })
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
                    onSuccess: () =>
                      toast.show({
                        message: 'Ficha devolvida para correção.',
                      }),
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
    </View>
  )
}

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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.space[2],
  },
})
