import {
  describe,
  fmtSigned,
  type ListItem,
  type ListMeta,
  type ResolvedList,
  saySigned,
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

/**
 * Pontos do item. A linha fixa com valor mostra os pips mesmo vazia, como a
 * linha em branco da ficha de papel (Ressonância: ○○○○○).
 */
export const itemValue = (
  list: ResolvedList,
  item: ListItem
): number | undefined => {
  const value = list.field.def.item.value
  if (!value) return undefined
  if (typeof item.value === 'number') return item.value
  return list.field.def.fixed ? (value.min ?? 0) : undefined
}

/** "Taumaturgia, 3 de 5, especialização Trilha do Sangue". */
export function describeItem(list: ResolvedList, item: ListItem): string {
  const def = list.field.def
  const parts = [itemTitle(list, item)]
  if (def.fixed && item.text) parts.push(item.text)
  const value = itemValue(list, item)
  if (def.item.value && value !== undefined)
    parts.push(`${value} de ${def.item.value.max}`)
  for (const m of def.item.meta ?? []) {
    const v = item.meta?.[m.id]
    if (v === undefined || v === '') continue
    // O sinal falado ("Ataque mais 2"), como o número com `signed`
    parts.push(
      m.display === 'signed' && typeof v === 'number'
        ? `${m.label} ${saySigned(v)}`
        : `${m.label} ${v}`
    )
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

/**
 * Um meta na linha do item: o número com o rótulo ("Bônus 2", "Ataque +5"),
 * como o leitor de tela já fala; o texto só com o valor ("Social").
 */
function metaText(m: ListMeta, v: number | string): string {
  if (m.type !== 'number' || typeof v !== 'number') return String(v)
  return `${m.label} ${m.display === 'signed' ? fmtSigned(v) : v}`
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
    .flatMap(m => {
      const v = item.meta?.[m.id]
      return v === undefined || v === '' ? [] : [metaText(m, v)]
    })
    .join(' · ')
  const value = itemValue(list, item)
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
      {def.item.value && value !== undefined ? (
        <>
          <RatingDots value={value} max={def.item.value.max} size="sm" />
          <Text variant="number">{String(value)}</Text>
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
            itemValue(resolved, item) !== undefined
              ? { text: String(itemValue(resolved, item)) }
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
