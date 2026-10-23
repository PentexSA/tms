import type { CreationProblem, PriorityBudget } from '@tms/sheet-core'
import {
  Banner,
  Button,
  Choice,
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
  completeLabel,
  creationRefusalOf,
  problemText,
  REFUSAL_TEXT,
  reorder,
} from './creation'

// O painel do modo de criação (doc/plano-v4.md, Etapa 5): prioridades, saldo
// de bônus, o que falta para fechar e "Concluir criação", separado do
// "Salvar alterações" do rascunho. Concluir exige rede, rascunho salvo e a
// fila confirmada: a conclusão nunca confirma escolhas ainda locais.

const RANKS = ['Primária', 'Secundária', 'Terciária', 'Quarta', 'Quinta']

export function CreationPanel() {
  const creation = useCreation()
  const { model, roles, store } = useSheet()
  const check = useSheetSelector(s => s.check)
  const refusal = useSheetSelector(s => s.creationRefusal)
  const dirty = useSheetSelector(s => (s.draft?.size ?? 0) > 0)
  const queued = useSheetSelector(s => s.pending.length > 0)
  const toast = useToast()
  const save = useSaveCreation(creation?.characterId ?? '')
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
  const priorities = (model.template.creation?.budgets ?? []).filter(
    (b): b is PriorityBudget => b.rule === 'priority-budget'
  )

  const choose = (budget: PriorityBudget, group: string, rank: number) => {
    const current = info.choices.priorities?.[budget.id]
    const order = reorder(
      current,
      budget.groups.map(g => g.id),
      group,
      rank
    )
    save.mutate(
      {
        revision: info.revision,
        choices: {
          priorities: {
            ...(info.choices.priorities ?? {}),
            [budget.id]: order,
          },
        },
      },
      {
        onError: error => {
          const code = creationRefusalOf(errorBody(error))
          toast.show({
            message: code
              ? REFUSAL_TEXT[code]
              : messageOf(error, 'Não foi possível salvar as prioridades.'),
          })
        },
      }
    )
  }

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
          const body = errorBody(error) as { problems?: unknown } | null
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
      {priorities.map(budget => {
        const order = info.choices.priorities?.[budget.id]
        const values =
          (info.effective.budgets?.[budget.id] as number[] | undefined) ??
          budget.budgets
        return (
          <View key={budget.id} style={styles.block}>
            <SectionHeader
              title={`Prioridades: ${budget.label}`}
              level="group"
            />
            {budget.groups.map(g => {
              const rank = order ? order.indexOf(g.id) : -1
              return (
                <Choice
                  key={g.id}
                  label={g.label}
                  testID={`priority-${budget.id}-${g.id}`}
                  value={rank < 0 ? null : String(rank)}
                  onChange={id => choose(budget, g.id, Number(id))}
                  options={values.map((n, i) => ({
                    id: String(i),
                    label: `${RANKS[i] ?? `${i + 1}ª`} (${n})`,
                    spoken: `${g.label}, ${RANKS[i] ?? `${i + 1}ª`}, ${n} pontos`,
                  }))}
                />
              )
            })}
          </View>
        )
      })}
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
    const code = creationRefusalOf(errorBody(failure))
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
          const code = creationRefusalOf(errorBody(error))
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

const errorBody = (error: unknown): unknown =>
  (error as { value?: unknown } | null)?.value ?? null

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
