import {
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

  return (
    <View style={styles.panel} testID="creation-settings">
      <SectionHeader title="Criação de fichas" />
      <Text color="inkMuted">
        Estas regras valem para novas fichas. Ajustes de uma ficha específica
        continuam disponíveis nela.
      </Text>
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
        <>
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
          {effective.mode === 'points' ? (
            <View style={styles.rules}>
              {model.template.creation.budgets.map(budget =>
                budget.rule === 'priority-budget' ? (
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
                ) : (
                  <Stepper
                    key={budget.id}
                    label={budget.label}
                    value={
                      (effective.budgets?.[budget.id] as number | undefined) ??
                      budget.budget
                    }
                    min={0}
                    max={1000}
                    onChange={value => setBudget(budget.id, value)}
                  />
                )
              )}
              {model.template.creation.freebies !== undefined ? (
                <Stepper
                  label="Pontos de bônus"
                  value={effective.freebies ?? 0}
                  min={0}
                  max={1000}
                  onChange={freebies =>
                    setDefaults(current => ({ ...current, freebies }))
                  }
                />
              ) : null}
            </View>
          ) : null}
        </>
      )}
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

function PriorityControls({
  budget,
  values,
  onChange,
}: {
  readonly budget: PriorityBudget
  readonly values: readonly number[]
  readonly onChange: (values: readonly number[]) => void
}) {
  return (
    <View style={styles.rules}>
      <Text variant="fieldLabel">{budget.label}</Text>
      {values.map((value, index) => (
        <Stepper
          key={`${budget.id}-${index}`}
          label={RANKS[index] ?? `${index + 1}ª prioridade`}
          value={value}
          min={0}
          max={1000}
          onChange={next => {
            const changed = [...values]
            changed[index] = next
            onChange(changed)
          }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[4],
  },
  rules: { gap: tokens.space[2] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
})
