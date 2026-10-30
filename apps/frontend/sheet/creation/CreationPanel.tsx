import type { CreationProblem } from '@tms/sheet-core'
import {
  Banner,
  Button,
  SectionHeader,
  Stepper,
  Text,
  TextField,
  tokens,
  useToast,
} from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

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
  type CreationPhase,
  completeLabel,
  creationRefusalOf,
  errorBodyOf,
  problemText,
  REFUSAL_TEXT,
} from './creation'
import { RadioChips } from './RadioChips'

// O painel do modo de criação (doc/plano-v4.md, Etapa 5): o que os pontos
// gastam (básicos ou bônus), saldo de bônus, o que falta para fechar e
// "Concluir criação", separado do "Salvar alterações" do rascunho. As
// prioridades ficam no cabeçalho de cada grupo (CreationCounter). Concluir
// exige rede, rascunho salvo e a fila confirmada: a conclusão nunca confirma
// escolhas ainda locais.

const PHASES: readonly {
  readonly id: CreationPhase
  readonly label: string
}[] = [
  { id: 'basics', label: 'Pontos básicos' },
  { id: 'freebies', label: 'Pontos de bônus' },
]

export function CreationPanel() {
  const creation = useCreation()
  const { model, roles, store } = useSheet()
  const check = useSheetSelector(s => s.check)
  const refusal = useSheetSelector(s => s.creationRefusal)
  const dirty = useSheetSelector(s => (s.draft?.size ?? 0) > 0)
  const queued = useSheetSelector(s => s.pending.length > 0)
  const phase = useSheetSelector(s => s.creationPhase)
  const toast = useToast()
  const complete = useCompleteCreation(
    creation?.characterId ?? '',
    creation?.chronicleId ?? ''
  )
  const [serverProblems, setServerProblems] = useState<
    readonly CreationProblem[] | null
  >(null)
  if (
    !creation?.active ||
    creation.status !== 'creating' ||
    !creation.info ||
    !check
  )
    return null
  const { info } = creation
  const storyteller = roles.has('storyteller')
  const blocked = dirty
    ? 'Salve as alterações antes de concluir.'
    : queued
      ? 'Aguarde a sincronização antes de concluir.'
      : !check.complete
        ? REFUSAL_TEXT.CREATION_INCOMPLETE
        : null

  const finish = () => {
    setServerProblems(null)
    complete.mutate(
      {
        revision: info.revision,
        sheetVersion: store.getState().sheetVersion,
      },
      {
        onSuccess: result =>
          toast.show({
            message:
              result.status === 'pending'
                ? 'Ficha enviada. Ela aguarda a aprovação do narrador.'
                : 'Criação concluída. Subir um traço agora passa pelo narrador.',
          }),
        onError: error => {
          const body = errorBodyOf(error) as { problems?: unknown } | null
          if (Array.isArray(body?.problems))
            setServerProblems(body.problems as CreationProblem[])
          const code = creationRefusalOf(body)
          toast.show({
            message: code
              ? REFUSAL_TEXT[code]
              : messageOf(error, 'Não foi possível concluir a criação.'),
          })
        },
      }
    )
  }

  const problems = serverProblems ?? check.problems
  const freebies = check.freebies

  return (
    <View style={styles.panel} testID="creation-panel">
      {info.returned && creation.status === 'creating' ? (
        <Banner
          tone="warning"
          title="O narrador devolveu a ficha"
          message={info.returned.reason}
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
      ) : null}
      {storyteller ? <BudgetControls /> : null}
      <View style={styles.actions}>
        {blocked ? (
          <Text variant="caption" color="inkMuted" style={styles.flex}>
            {blocked}
          </Text>
        ) : null}
        <Button
          title={completeLabel(info, roles)}
          testID="creation-complete"
          disabled={Boolean(blocked) || complete.isPending}
          onPress={finish}
        />
      </View>
    </View>
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
  flex: { flex: 1, minWidth: 160 },
})
