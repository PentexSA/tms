import { stored } from '@tms/sheet-core'
import { Stepper, Text, tokens } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { FieldViewProps } from '../views/types'
import { EditorShell } from './EditorShell'
import { useClassNote, useFieldIssue, useSetDraft } from './hooks'

// resource em Evoluir: o permanente (FdV do WoD), o máximo guardado (PV do
// D&D, Sanidade inicial) e o atual. O jogo do dia a dia (gastar, recuperar)
// fica no modo Jogo; aqui é a montagem da ficha.

export function ResourceEditorRow({ resolved, sheet }: FieldViewProps) {
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  // O permanente e o máximo são evolução; o atual, jogo (doc/plano-v3.md, Etapa 4)
  const advance = useClassNote('advance')
  const play = useClassNote('play')
  const [error, setError] = useState<string | null>(null)
  if (resolved.type !== 'resource') return null
  const r = resolved
  const def = r.field.def
  const base = stored(r, sheet) as Record<string, number>
  const write = (patch: Record<string, number>) =>
    setError(set(`values.${r.id}`, { ...base, ...patch }))
  const capped = !def.tempUncapped && !def.overMax
  const rows: {
    key: string
    label: string
    value: number
    min: number
    max: number
    onChange: (n: number) => void
    blocked: string | null
  }[] = []
  if (def.permanent && r.permanent !== null)
    rows.push({
      key: 'permanent',
      label: `${def.label} permanente`,
      value: r.permanent,
      min: def.permanent.min,
      max: def.permanent.max,
      // Baixar o permanente leva o atual junto (o permanente limita o atual)
      onChange: n =>
        write(
          capped && r.current > n
            ? { permanent: n, current: n }
            : { permanent: n }
        ),
      blocked: advance,
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
      onChange: n =>
        write(capped && r.current > n ? { max: n, current: n } : { max: n }),
      blocked: advance,
    })
  rows.push({
    key: 'current',
    label: `${def.label} atual`,
    value: r.current,
    min: 0,
    max: capped ? (r.cap ?? r.shownMax ?? 9999) : 9999,
    onChange: n => write({ current: n }),
    blocked: play,
  })
  // A nota do que está desabilitado, uma vez só
  const note = rows.find(row => row.blocked)?.blocked ?? null
  return (
    <EditorShell
      label={def.label}
      sub={note}
      error={error ?? issue}
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
