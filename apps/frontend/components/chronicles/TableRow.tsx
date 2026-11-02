import { describe, identityOf } from '@tms/sheet-core'
import {
  Avatar,
  Pressable,
  Skeleton,
  StateBadge,
  Text,
  ThemeProvider,
  tokens,
  useTheme,
} from '@tms/ui'
import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import { SheetProvider } from '../../sheet/context'
import { FieldSlot } from '../../sheet/FieldSlot'
import { unsupportedShort } from '../../sheet/UnsupportedTemplate'
import { changeLabel, type TableItem } from './tableItems'

// Uma linha da Mesa (doc/plano-v0.md, Etapa 19; doc/plano-v3.md, Etapa 9): os
// campos do dock do template na variante `chip`, os alertas do template como
// selo e o estado da ficha. Nada aqui conhece sistema. Memo: a mesma linha não
// redesenha quando o filtro ou a ordem mudam.
//
// T-48 (P09-C): o cartão compacto. Em cima, o avatar e o texto (nome em até 2
// linhas, o selo de identidade e quem alterou); depois, a linha de selos
// (estado e alertas); embaixo, os recursos do dock numa linha só, na largura
// inteira do cartão, como o CombatDock da ficha. A linha de selos é onde
// entram o estado do P04-D e a visibilidade do NPC do P11, e o progresso do
// P09-D ganha uma linha livre.

export const TableRow = memo(function TableRow({
  item,
  onOpen,
  selecting = false,
  selected = false,
  onSelect,
  framed = false,
}: {
  readonly item: TableItem
  readonly onOpen: (id: string) => void
  readonly selecting?: boolean
  readonly selected?: boolean
  readonly onSelect?: (id: string) => void
  // Na grade (telas largas), o cartão tem borda e raio; na coluna única, o
  // separador entre as linhas
  readonly framed?: boolean
}) {
  const { row, model, store, alerts, state, visibility } = item
  const { colors } = useTheme()
  const resolved = store?.getState()
  const identity = resolved ? identityOf(resolved.resolved) : null
  const dock = model?.template.dock ?? []
  const meta = changeLabel(row)
  const problem =
    model === null
      ? unsupportedShort('ficha')
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
    visibility,
    state?.label,
    ...alerts.map(a => a.label),
    ...described,
    problem,
    meta,
  ]
    .filter((part): part is string => Boolean(part))
    // O texto de cada parte fica como está (o nome "Quem?" ou "Dr. Who
    // Jr." é o que aparece na tela, WCAG 2.5.3). Só o separador gerado se
    // ajusta: depois de uma parte que já termina em pontuação, vai só o
    // espaço, sem ".."
    .reduce(
      (text, part) =>
        text ? `${text}${/[.!?…]$/u.test(text) ? ' ' : '. '}${part}` : part,
      ''
    )

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
        style={[
          styles.card,
          framed
            ? [styles.framed, { borderColor: colors.borderSubtle }]
            : { borderBottomColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.top}>
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
            <Text variant="caption" color="inkMuted">
              {meta}
            </Text>
            {problem ? (
              <Text variant="caption" color="inkMuted">
                {problem}
              </Text>
            ) : null}
          </View>
        </View>
        {/* A linha de selos: a visibilidade do NPC (T-52, P11), o estado
            (D-02, P04-D) e os alertas do template, sempre com texto */}
        {visibility || state || alerts.length ? (
          <View style={styles.badges} testID={`table-badges-${row.id}`}>
            {visibility ? (
              <StateBadge
                label={visibility}
                tone="neutral"
                testID={`visibility-${row.id}`}
              />
            ) : null}
            {state ? (
              <StateBadge
                label={state.label}
                tone={state.tone}
                testID={`table-state-${row.id}`}
              />
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
        {store ? (
          <SheetProvider store={store}>
            <View style={styles.chips} testID={`table-dock-${row.id}`}>
              {dock.map(id => (
                <View key={id} style={styles.chip}>
                  <FieldSlot id={id} variant="chip" />
                </View>
              ))}
            </View>
          </SheetProvider>
        ) : model === undefined ? (
          <Skeleton lines={1} label="Carregando o dock" />
        ) : null}
      </Pressable>
    </ThemeProvider>
  )
})

const styles = StyleSheet.create({
  card: {
    gap: tokens.space[2],
    minHeight: tokens.size.rowMin + 16,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  framed: {
    borderWidth: tokens.borderWidth.hair,
    borderRadius: tokens.radius.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[3],
  },
  text: { flex: 1, minWidth: 0, gap: tokens.space[1] },
  // Os recursos numa linha: cada um com a mesma fração da largura
  chips: { flexDirection: 'row', gap: tokens.space[2] },
  chip: { flex: 1, minWidth: 0 },
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
