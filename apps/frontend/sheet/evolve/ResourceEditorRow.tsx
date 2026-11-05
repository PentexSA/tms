import { editResource, type ResourcePart } from '@tms/sheet-core'
import { Stepper, type StepperIncrease, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useCreation } from '../creation/CreationContext'
import type { FieldViewProps } from '../views/types'
import { EditorShell } from './EditorShell'
import { useClassNote, useFieldIssue, useSetDraft } from './hooks'
import { useRowFeedback } from './useRowFeedback'

// resource em Evoluir: o permanente (FdV do WoD), o máximo guardado (PV do
// D&D, Sanidade inicial) e o atual. O jogo do dia a dia (gastar, recuperar)
// fica no modo Jogo; aqui é a montagem da ficha.

// Na criação (creating ou pending), o atual cheio acompanha o permanente
// (T-22). Sem provedor (prévias, Mesa) ou com a ficha concluída, o de antes.
const FOLLOWS = new Set(['creating', 'pending'])

export function ResourceEditorRow({ resolved }: FieldViewProps) {
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  // O permanente e o máximo são evolução; o atual, jogo (doc/plano-v3.md, Etapa 4)
  const advance = useClassNote('advance')
  const play = useClassNote('play')
  // A recusa do toque mora no store e some quando a causa some (T-55); na
  // criação, o custo do próximo ponto do permanente (FdV, R-17)
  const feedback = useRowFeedback(`values.${resolved.id}`, resolved.id)
  const status = useCreation()?.status
  const follow = status !== undefined && FOLLOWS.has(status)
  if (resolved.type !== 'resource') return null
  const r = resolved
  const def = r.field.def
  const write = (part: ResourcePart, n: number) =>
    set(`values.${r.id}`, editResource(r, part, n, { follow }))
  const capped = !def.tempUncapped && !def.overMax
  const rows: {
    key: string
    label: string
    value: number
    min: number
    max: number
    onChange: (n: number) => void
    blocked: string | null
    increase?: StepperIncrease
    decrease?: StepperIncrease
  }[] = []
  if (def.permanent && r.permanent !== null)
    rows.push({
      key: 'permanent',
      label: `${def.label} permanente`,
      value: r.permanent,
      min: def.permanent.min,
      max: def.permanent.max,
      // Baixar o permanente leva o atual junto (o permanente limita o atual);
      // na criação, o atual cheio também sobe junto
      onChange: n => write('permanent', n),
      blocked: advance,
      increase: feedback.increase,
      // Só o permanente tem valor inicial; o atual é de jogo (T-85)
      decrease: feedback.decrease,
    })
  const storedMax =
    def.max && typeof def.max === 'object' && 'stored' in def.max
  if (storedMax && r.max !== null)
    rows.push({
      key: 'max',
      label: `${def.label} máximo`,
      value: r.max,
      min: 0,
      max: 9999,
      onChange: n => write('max', n),
      blocked: advance,
    })
  rows.push({
    key: 'current',
    label: `${def.label} atual`,
    value: r.current,
    min: 0,
    max: capped ? (r.cap ?? r.shownMax ?? 9999) : 9999,
    onChange: n => write('current', n),
    blocked: play,
  })
  // A nota do que está desabilitado, uma vez só
  const note = rows.find(row => row.blocked)?.blocked ?? null
  return (
    <EditorShell
      label={def.label}
      sub={note}
      note={feedback.note}
      error={feedback.notice ?? issue}
      testID={`editor-${r.id}`}
      below={
        <View style={styles.rows}>
          {rows.map(row => (
            <View key={row.key} style={styles.row}>
              <Text color="inkMuted" style={styles.label}>
                {row.label}
              </Text>
              <Stepper
                label={row.label}
                value={row.value}
                min={row.min}
                max={row.max}
                onChange={row.onChange}
                disabled={row.blocked !== null}
                increase={row.increase}
                decrease={row.decrease}
              />
            </View>
          ))}
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  rows: { gap: tokens.space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  label: { flex: 1 },
})
