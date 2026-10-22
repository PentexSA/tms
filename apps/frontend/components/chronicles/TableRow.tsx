import { describe, identityOf } from '@tms/sheet-core'
import {
  Avatar,
  Pressable,
  Skeleton,
  Text,
  ThemeProvider,
  tokens,
  useTheme,
} from '@tms/ui'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import { whenLabel } from '../../lib/format'
import { SheetProvider } from '../../sheet/context'
import { FieldSlot } from '../../sheet/FieldSlot'
import type { TableItem } from './tableItems'

// Uma linha da Mesa (doc/plano-v0.md, Etapa 19; doc/plano-v3.md, Etapa 9): os
// campos do dock do template na variante `chip`, os alertas do template como
// selo e o estado da ficha. Nada aqui conhece sistema. Memo: a mesma linha não
// redesenha quando o filtro ou a ordem mudam.

export const TableRow = memo(function TableRow({
  item,
  onOpen,
  selecting = false,
  selected = false,
  onSelect,
}: {
  readonly item: TableItem
  readonly onOpen: (id: string) => void
  readonly selecting?: boolean
  readonly selected?: boolean
  readonly onSelect?: (id: string) => void
}) {
  const { row, model, store, alerts, state } = item
  const { colors } = useTheme()
  const resolved = store?.getState()
  const identity = resolved ? identityOf(resolved.resolved) : null
  const dock = model?.template.dock ?? []
  const meta = `${row.owner.username} · alterada ${whenLabel(row.updatedAt)}`
  const problem =
    model === null
      ? 'Atualize o app para ver esta ficha.'
      : model && !store
        ? 'Ficha com dados inválidos.'
        : null
  // O nome acessível da linha diz o que os chips e os selos mostram (a
  // linha é um alvo só)
  const described = resolved
    ? dock
        .map(id => {
          const entry = resolved.entries.get(id)
          return entry ? describe(entry.resolved, entry.sheet) : null
        })
        .filter(Boolean)
    : []
  const label = [
    [row.name, identity?.chip].filter(Boolean).join(', '),
    state,
    ...alerts.map(a => a.label),
    ...described,
    problem,
    meta,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <ThemeProvider accent={identity?.accent ?? 'accent-neutral'}>
      <Pressable
        accessibilityRole={selecting ? 'checkbox' : 'button'}
        accessibilityLabel={selecting ? `Selecionar ${row.name}` : label}
        aria-checked={selecting ? selected : undefined}
        accessibilityHint={
          selecting ? 'Inclui na operação em grupo' : 'Abre a ficha em leitura'
        }
        onPress={() => (selecting ? onSelect?.(row.id) : onOpen(row.id))}
        testID={`table-row-${row.id}`}
        style={[styles.row, { borderBottomColor: colors.borderSubtle }]}
      >
        {selecting ? (
          <Text color={selected ? 'action' : 'inkMuted'}>
            {selected ? '☑' : '☐'}
          </Text>
        ) : null}
        <Avatar name={row.name} emblem={model?.template.identity.emblem} />
        <View style={styles.text}>
          <Text variant="fieldLabel" numberOfLines={2}>
            {row.name}
          </Text>
          {identity?.chip ? (
            <Text variant="caption" color="accent">
              {identity.chip}
            </Text>
          ) : null}
          {state || alerts.length ? (
            <View style={styles.badges}>
              {state ? (
                <Text variant="caption" color="inkMuted">
                  {state}
                </Text>
              ) : null}
              {alerts.map(a => (
                <Text
                  key={a.id}
                  variant="caption"
                  color="danger"
                  testID={`alert-${row.id}-${a.id}`}
                  style={[styles.badge, { borderColor: colors.danger }]}
                >
                  {a.label}
                </Text>
              ))}
            </View>
          ) : null}
          <Text variant="caption" color="inkMuted">
            {meta}
          </Text>
          {problem ? (
            <Text variant="caption" color="inkMuted">
              {problem}
            </Text>
          ) : null}
          {store ? (
            <SheetProvider store={store}>
              <View style={styles.chips}>
                {dock.map(id => (
                  <FieldSlot key={id} id={id} variant="chip" />
                ))}
              </View>
            </SheetProvider>
          ) : model === undefined ? (
            <Skeleton lines={1} label="Carregando o dock" />
          ) : null}
        </View>
      </Pressable>
    </ThemeProvider>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin + 16,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  text: { flex: 1, gap: tokens.space[1] },
  chips: { gap: tokens.space[1], marginTop: tokens.space[1] },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.space[2],
  },
  badge: {
    borderWidth: tokens.borderWidth.hair,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: tokens.space[1],
  },
})
