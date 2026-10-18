import { type CompiledGroup, jsonEqual } from '@tms/sheet-core'
import {
  Button,
  Pressable,
  SectionHeader,
  Text,
  textStyle,
  tokens,
  useTheme,
} from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import { useSheet, useSheetSelector } from '../context'
import { filterActive, visibleFields } from '../evolve/filters'
import { FieldSlot } from '../FieldSlot'
import type { LayoutProps } from './types'

// Grupos com título (Habilidades do WoD, perícias do D&D, Vantagens). O
// template pode pedir filtro (`filter: { rule, label, default }`) e busca
// (`searchable`). O filtro some em Evoluir: é ali que se compra o primeiro
// ponto. A lista visível é um seletor comparado por valor: gastar Sangue
// não re-renderiza as Habilidades.

export function GroupsLayout({ section }: LayoutProps) {
  const { mode } = useSheet()
  const filter = section.def.filter
  const [on, setOn] = useState(filter?.default ?? false)
  const [search, setSearch] = useState('')
  const filtered = filterActive(section, mode, on)
  const visible = useSheetSelector(
    s => visibleFields(section, s.resolved, { filtered, search }),
    jsonEqual
  )
  const shown = new Set(visible)
  const groups: readonly CompiledGroup[] = section.groups ?? [
    { id: section.id, title: '', fieldIds: section.fieldIds },
  ]
  const total = section.fieldIds.length
  const showFilter = Boolean(filter) && mode !== 'evolve'

  return (
    <View testID={`groups-${section.id}`}>
      {showFilter || section.def.searchable ? (
        <FilterBar
          title={section.def.title}
          filter={showFilter && filter ? { label: filter.label, on } : null}
          onToggle={() => setOn(v => !v)}
          searchable={Boolean(section.def.searchable)}
          search={search}
          onSearch={setSearch}
        />
      ) : null}
      {visible.length < total ? (
        <View style={styles.note}>
          <Text variant="caption" color="inkMuted" style={styles.flex}>
            {`Mostrando ${visible.length} de ${total}`}
          </Text>
          <Button
            title="Mostrar todos"
            variant="ghost"
            onPress={() => {
              setOn(false)
              setSearch('')
            }}
          />
        </View>
      ) : null}
      {groups.map(g => {
        const ids = g.fieldIds.filter(id => shown.has(id))
        return (
          <View key={g.id}>
            {g.title ? (
              <View style={styles.title}>
                <SectionHeader title={g.title} level="group" />
              </View>
            ) : null}
            {ids.length ? (
              ids.map(id => <FieldSlot key={id} id={id} variant="row" />)
            ) : (
              <Text color="inkMuted" style={styles.empty}>
                {g.title
                  ? `Nada para mostrar em ${g.title}.`
                  : 'Nada para mostrar.'}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

function FilterBar({
  title,
  filter,
  onToggle,
  searchable,
  search,
  onSearch,
}: {
  readonly title: string
  readonly filter: { readonly label: string; readonly on: boolean } | null
  readonly onToggle: () => void
  readonly searchable: boolean
  readonly search: string
  readonly onSearch: (v: string) => void
}) {
  const theme = useTheme()
  const { colors } = theme
  return (
    <View style={styles.bar}>
      {filter ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={filter.label}
          aria-checked={filter.on}
          onPress={onToggle}
          style={[
            styles.toggle,
            {
              borderColor: filter.on ? colors.action : colors.borderControl,
              backgroundColor: filter.on ? colors.surfaceRaised : 'transparent',
            },
          ]}
        >
          <Text variant="caption" color={filter.on ? 'action' : 'ink'}>
            {filter.label}
          </Text>
        </Pressable>
      ) : null}
      {searchable ? (
        <TextInput
          accessibilityLabel={`Buscar em ${title}`}
          placeholder="Buscar"
          placeholderTextColor={colors.inkMuted}
          value={search}
          onChangeText={onSearch}
          autoCorrect={false}
          autoCapitalize="none"
          maxLength={60}
          style={[
            styles.search,
            textStyle(theme, 'body'),
            { borderColor: colors.borderControl, color: colors.ink },
          ]}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { paddingHorizontal: tokens.layout.gutter },
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
  },
  toggle: {
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.control,
    paddingHorizontal: tokens.space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flex: 1,
    minWidth: 160,
    minHeight: tokens.size.hitSize,
    borderWidth: tokens.borderWidth.control,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.space[3],
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
  },
  empty: {
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
  },
})
