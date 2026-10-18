import {
  describe,
  type ListItem,
  type ResolvedList,
  short,
} from '@tms/sheet-core'
import { RatingDots, Text, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { noneOf } from '../evolve/text'
import { FieldTarget } from './FieldTarget'
import type { FieldViewProps } from './types'

// list (DS: Repeater). Uma linha por item, com pips quando o item tem valor e
// a especialização em itálico. `density: compact` vira chips (condições do
// D&D, equipamento do CoC). O conteúdo é do jogador: sempre <Text>.

export const itemTitle = (list: ResolvedList, item: ListItem): string => {
  const fixed = list.field.def.fixed?.find(f => f.id === item.id)
  return item.name ?? fixed?.label ?? item.text ?? ''
}

/** "Taumaturgia, 3 de 5, especialização Trilha do Sangue". */
export function describeItem(list: ResolvedList, item: ListItem): string {
  const def = list.field.def
  const parts = [itemTitle(list, item)]
  if (def.fixed && item.text) parts.push(item.text)
  if (def.item.value && typeof item.value === 'number')
    parts.push(`${item.value} de ${def.item.value.max}`)
  for (const m of def.item.meta ?? []) {
    const v = item.meta?.[m.id]
    if (v !== undefined && v !== '') parts.push(`${m.label} ${v}`)
  }
  if (item.specialty) parts.push(`especialização ${item.specialty}`)
  return parts.join(', ')
}

export function ListHeader({
  resolved,
  sheet,
}: FieldViewProps & { readonly resolved: ResolvedList }) {
  return (
    <FieldTarget
      id={resolved.id}
      label={describe(resolved, sheet)}
      value={short(resolved, sheet)}
      style={styles.header}
    >
      <Text variant="fieldLabel">{resolved.field.def.label}</Text>
      <Text variant="caption" color="inkMuted">
        {short(resolved, sheet)}
      </Text>
    </FieldTarget>
  )
}

export function ItemLine({
  list,
  item,
}: {
  readonly list: ResolvedList
  readonly item: ListItem
}) {
  const def = list.field.def
  const meta = (def.item.meta ?? [])
    .map(m => item.meta?.[m.id])
    .filter(v => v !== undefined && v !== '')
    .join(' · ')
  return (
    <>
      <View style={styles.itemText}>
        <Text>{itemTitle(list, item)}</Text>
        {def.fixed && item.text ? (
          <Text color="inkMuted">{item.text}</Text>
        ) : null}
        {meta ? (
          <Text variant="caption" color="inkMuted">
            {meta}
          </Text>
        ) : null}
        {item.specialty ? (
          <Text variant="caption" color="inkMuted" style={styles.specialty}>
            {item.specialty}
          </Text>
        ) : null}
      </View>
      {def.item.value && typeof item.value === 'number' ? (
        <>
          <RatingDots value={item.value} max={def.item.value.max} size="sm" />
          <Text variant="number">{String(item.value)}</Text>
        </>
      ) : null}
    </>
  )
}

export function ListRow({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  if (resolved.type !== 'list') return null
  const def = resolved.field.def
  const border = { borderBottomColor: colors.borderSubtle }
  if (!resolved.items.length)
    return (
      <FieldTarget
        id={resolved.id}
        label={describe(resolved, sheet)}
        value={short(resolved, sheet)}
        style={[styles.row, border]}
      >
        <Text variant="fieldLabel" style={styles.flex}>
          {def.label}
        </Text>
        <Text color="inkMuted">{noneOf(def.itemLabel)}</Text>
      </FieldTarget>
    )
  if (def.density === 'compact')
    return (
      <View style={[styles.compact, border]}>
        <ListHeader resolved={resolved} sheet={sheet} />
        <View style={styles.chips}>
          {resolved.items.map(item => (
            <View
              key={item.id}
              style={[styles.chip, { borderColor: colors.borderControl }]}
            >
              <Text variant="caption">{itemTitle(resolved, item)}</Text>
            </View>
          ))}
        </View>
      </View>
    )
  return (
    <View>
      <ListHeader resolved={resolved} sheet={sheet} />
      {resolved.items.map(item => (
        <View
          key={item.id}
          accessible
          accessibilityLabel={describeItem(resolved, item)}
          accessibilityValue={
            typeof item.value === 'number'
              ? { text: String(item.value) }
              : undefined
          }
          style={[styles.row, border]}
        >
          <ItemLine list={resolved} item={item} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  itemText: { flex: 1, gap: tokens.space['0.5'] },
  specialty: { fontStyle: 'italic' },
  compact: {
    gap: tokens.space[2],
    paddingBottom: tokens.space[2],
    borderBottomWidth: tokens.borderWidth.hair,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
  },
  chip: {
    borderWidth: tokens.borderWidth.hair,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.space[3],
    paddingVertical: tokens.space[1],
  },
})
