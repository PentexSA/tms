import {
  type CreationBudget,
  type CreationConfigLayer,
  effectiveCreationConfig,
  type PriorityBudget,
} from '@tms/sheet-core'
import {
  Button,
  Choice,
  SectionHeader,
  Stepper,
  Text,
  tokens,
  useLayout,
  useTheme,
  useToast,
} from '@tms/ui'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import { useChronicleCreationSettings } from '../../lib/queries/creation'
import { useCompiled, useLatestTemplate } from '../../sheet/data'

const RANKS = ['Primária', 'Secundária', 'Terciária', 'Quarta', 'Quinta']

export interface ChronicleCreationInfo {
  readonly approval: boolean
  readonly defaults: unknown
  readonly revision: number
}

const layerOf = (value: unknown): CreationConfigLayer =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as CreationConfigLayer)
    : {}

/** Regras padrão das próximas fichas, configuradas pelo narrador. */
export function CreationSettings({
  chronicleId,
  systemCode,
  creation,
}: {
  readonly chronicleId: string
  readonly systemCode: string
  readonly creation: ChronicleCreationInfo
}) {
  const latest = useLatestTemplate(systemCode)
  const model = useCompiled(latest.data)
  const mutation = useChronicleCreationSettings(chronicleId)
  const toast = useToast()
  const { colors } = useTheme()
  const { breakpoint, stacked } = useLayout()
  const [approval, setApproval] = useState(creation.approval)
  const [defaults, setDefaults] = useState<CreationConfigLayer>(() =>
    layerOf(creation.defaults)
  )

  useEffect(() => {
    setApproval(creation.approval)
    setDefaults(layerOf(creation.defaults))
  }, [creation])

  const effective = useMemo(
    () => (model ? effectiveCreationConfig(model, defaults) : null),
    [model, defaults]
  )
  const changed =
    approval !== creation.approval ||
    JSON.stringify(defaults) !== JSON.stringify(layerOf(creation.defaults))

  const setBudget = (id: string, value: number | readonly number[]) =>
    setDefaults(current => ({
      ...current,
      budgets: { ...(current.budgets ?? {}), [id]: value },
    }))

  const columns = breakpoint === 'expanded' && !stacked
  const points =
    model && model.template.creation && effective?.mode === 'points'
      ? model.template.creation
      : null
  const others = (points?.budgets ?? []).filter(
    (budget): budget is Exclude<CreationBudget, PriorityBudget> =>
      budget.rule !== 'priority-budget'
  )

  return (
    <View style={styles.panel} testID="creation-settings">
      <SectionHeader
        title="Criação de fichas"
        subtitle="Valem para as fichas criadas a partir de agora. Para mudar uma ficha que já existe, use as Regras da casa dentro dela."
      />
      <View
        style={columns ? styles.columns : styles.rules}
        testID="creation-settings-layout"
      >
        <View style={[styles.rules, columns && styles.column]}>
          <SectionHeader title="Como funciona" level="group" />
          <Choice
            label="Aprovação do narrador"
            value={approval ? 'on' : 'off'}
            onChange={value => setApproval(value === 'on')}
            options={[
              { id: 'off', label: 'Desligada' },
              { id: 'on', label: 'Ligada' },
            ]}
          />
          {model === undefined ? (
            <Text color="inkMuted">Carregando as regras do sistema…</Text>
          ) : model === null || !model.template.creation || !effective ? (
            <Text color="inkMuted">
              Este sistema usa criação livre; não há orçamento por pontos para
              configurar.
            </Text>
          ) : (
            <Choice
              label="Modo padrão"
              value={effective.mode}
              onChange={value =>
                setDefaults(current => ({
                  ...current,
                  mode: value === 'free' ? 'free' : 'points',
                }))
              }
              options={[
                { id: 'points', label: 'Por pontos' },
                { id: 'free', label: 'Livre' },
              ]}
            />
          )}
        </View>
        {points && effective ? (
          <View
            style={[styles.rules, columns && styles.column]}
            testID="creation-settings-budgets"
          >
            <SectionHeader title="Orçamento" level="group" />
            {points.budgets
              .filter(
                (budget): budget is PriorityBudget =>
                  budget.rule === 'priority-budget'
              )
              .map(budget => (
                <PriorityControls
                  key={budget.id}
                  budget={budget}
                  values={
                    (effective.budgets?.[budget.id] as
                      | readonly number[]
                      | undefined) ?? budget.budgets
                  }
                  onChange={values => setBudget(budget.id, values)}
                />
              ))}
            {others.length || points.freebies !== undefined ? (
              <View style={[styles.box, { borderColor: colors.borderSubtle }]}>
                {others.map(budget => (
                  <LabeledStepper
                    key={budget.id}
                    label={budget.label}
                    value={
                      (effective.budgets?.[budget.id] as number | undefined) ??
                      budget.budget
                    }
                    onChange={value => setBudget(budget.id, value)}
                  />
                ))}
                {points.freebies !== undefined ? (
                  <LabeledStepper
                    label="Pontos de bônus"
                    value={effective.freebies ?? 0}
                    onChange={freebies =>
                      setDefaults(current => ({ ...current, freebies }))
                    }
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {mutation.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {messageOf(mutation.error, 'Não foi possível salvar as regras.')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          title="Salvar regras da criação"
          testID="creation-settings-save"
          busy={mutation.isPending}
          disabled={!changed || mutation.isPending}
          onPress={() =>
            mutation.mutate(
              {
                revision: creation.revision,
                approval,
                defaults: defaults as Record<string, unknown>,
              },
              {
                onSuccess: () =>
                  toast.show({ message: 'Regras da criação salvas.' }),
              }
            )
          }
        />
      </View>
    </View>
  )
}

/** Uma linha por prioridade, lado a lado: "Primária 7 · Secundária 5 · ...". */
function PriorityControls({
  budget,
  values,
  onChange,
}: {
  readonly budget: PriorityBudget
  readonly values: readonly number[]
  readonly onChange: (values: readonly number[]) => void
}) {
  const { colors } = useTheme()
  return (
    <View
      style={[styles.box, { borderColor: colors.borderSubtle }]}
      testID={`creation-settings-${budget.id}`}
    >
      <Text variant="fieldLabel">{budget.label}</Text>
      <View style={styles.ranks}>
        {values.map((value, index) => {
          const rank = RANKS[index] ?? `${index + 1}ª prioridade`
          return (
            <View key={`${budget.id}-${index}`} style={styles.rank}>
              <Text variant="caption" color="inkMuted">
                {rank}
              </Text>
              <Stepper
                label={`${budget.label}, ${rank}`}
                value={value}
                min={0}
                max={1000}
                onChange={next => {
                  const changed = [...values]
                  changed[index] = next
                  onChange(changed)
                }}
              />
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** O Stepper não mostra o rótulo: aqui ele fica ao lado, visível. */
function LabeledStepper({
  label,
  value,
  onChange,
}: {
  readonly label: string
  readonly value: number
  readonly onChange: (value: number) => void
}) {
  return (
    <View style={styles.line}>
      <Text style={styles.flex}>{label}</Text>
      <Stepper
        label={label}
        value={value}
        min={0}
        max={1000}
        onChange={onChange}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[4],
  },
  rules: { gap: tokens.space[3] },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[6],
  },
  column: { flex: 1 },
  box: {
    gap: tokens.space[2],
    borderWidth: tokens.borderWidth.hair,
    borderRadius: tokens.radius.md,
    padding: tokens.space[3],
  },
  ranks: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[3] },
  rank: { gap: tokens.space[1] },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
  },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
})
