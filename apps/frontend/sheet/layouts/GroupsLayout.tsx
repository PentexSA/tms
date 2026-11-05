import {
  type CompiledGroup,
  type FieldId,
  isDraftMode,
  jsonEqual,
} from '@tms/sheet-core'
import {
  Button,
  hitTarget,
  Pressable,
  Text,
  textStyle,
  tokens,
  useLayout,
  useTheme,
} from '@tms/ui'
import { type ReactNode, useState } from 'react'
import {
  type StyleProp,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native'
import { useSheet, useSheetSelector } from '../context'
import { CreationCounter } from '../creation/CreationCounter'
import { filterActive, visibleFields } from '../evolve/filters'
import { FieldSlot } from '../FieldSlot'
import { ChipFlow } from './ChipFlow'
import { blockHelp, GroupHelpLine, GroupTitle } from './groupHelp'
import { useGroupTabs } from './groupTabs'
import { echoesSection, HeadedList, titledList } from './headedList'
import type { LayoutProps } from './types'

// Grupos com título (Habilidades do WoD, perícias do D&D, Vantagens). O
// template pode pedir filtro (`filter: { rule, label, default }`) e busca
// (`searchable`). O filtro some em Evoluir: é ali que se compra o primeiro
// ponto. A lista visível é um seletor comparado por valor: gastar Sangue
// não re-renderiza as Habilidades. Com `groupTabs`, no celular cada grupo é
// uma aba (no Editar, ou com o filtro desligado); com busca, o resultado vem
// de todos os grupos. Com o filtro ligado, fora do Editar, os traços viram
// chips "Nome N" (ChipFlow), todos os grupos à vista. Com `badge`
// (contrato §6), a linha cujo id é o valor do `choice` citado ganha o selo
// (a Esfera de afinidade do Mago).

export function GroupsLayout({ section, titled: sectionTitled }: LayoutProps) {
  const { mode, model } = useSheet()
  const filter = section.def.filter
  const [on, setOn] = useState(filter?.default ?? false)
  const [search, setSearch] = useState('')
  const filtered = filterActive(section, mode, on)
  const visible = useSheetSelector(
    s => visibleFields(section, s.resolved, { filtered, search }),
    jsonEqual
  )
  const shown = new Set(visible)
  // Item de lista (Disciplinas) tem várias linhas: não vira chip
  const isList = (id: string) => model.fields.get(id)?.def.type === 'list'
  const badge = section.def.badge
  const badged = useSheetSelector(s => {
    const r = badge ? s.resolved.get(badge.field) : undefined
    return r?.type === 'choice' ? r.value : null
  })
  const groups: readonly CompiledGroup[] = section.groups ?? [
    { id: section.id, title: '', fieldIds: section.fieldIds },
  ]
  const total = section.fieldIds.length
  const showFilter = Boolean(filter) && !isDraftMode(mode)
  const searching = search.trim() !== ''
  // Abas no Editar e, fora dele, quando a seção mostra tudo em linhas
  // (filtro desligado); com o filtro ligado, os chips cabem inteiros
  const tabs = useGroupTabs(section, groups, {
    enabled: isDraftMode(mode) || !filtered,
    all: searching,
  })
  // O título do grupo some quando a aba já diz qual é
  const titled = !tabs.tabbed || searching
  // T-58: o grupo único com o nome da seção à vista não repete o título nem
  // o contador (W20 "Dons", M20 "Antecedentes"): o cabeçalho é o da seção
  const echo = Boolean(sectionTitled) && echoesSection(section)
  // T-28 (C-10): no desktop, os grupos lado a lado, cada um com pelo menos
  // GROUP_COL_MIN; a busca e o "Mostrando" ficam acima, na largura toda
  const { breakpoint, stacked } = useLayout()
  const columns =
    breakpoint === 'expanded' && !stacked && !tabs.tabbed && groups.length > 1

  return (
    <View testID={`groups-${section.id}`}>
      {tabs.bar}
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
      <View
        {...tabs.panelProps}
        style={columns ? styles.columns : undefined}
        testID={`groups-${section.id}-body`}
      >
        {tabs.groups.map(g => {
          const ids = g.fieldIds.filter(id => shown.has(id))
          if (searching && tabs.tabbed && !ids.length) return null
          const header = Boolean(g.title) && titled && !echo
          // A lista que o título à vista (do grupo ou da seção) já nomeia
          const headed = titledList(
            model,
            g.fieldIds,
            header ? g.title : echo ? section.def.title : null
          )
          // A frase do grupo e, no bloco que o título nomeia (T-58), a da
          // lista: com as duas, o "?" mostra as duas (blockHelp)
          const listDef = headed ? model.fields.get(headed)?.def : undefined
          const draft = isDraftMode(mode)
          const groupText = draft ? g.help : null
          const listText = draft ? listDef?.help : null
          return (
            <GroupBlock
              key={g.id}
              headed={headed}
              style={columns ? styles.column : undefined}
            >
              {header ? (
                <View style={styles.title}>
                  <GroupTitle
                    title={g.title}
                    help={blockHelp(g.title, groupText, listText)}
                    testID={`group-help-${g.id}`}
                    right={
                      <CreationCounter fieldIds={g.fieldIds} items={headed} />
                    }
                  />
                </View>
              ) : g.title && !echo ? (
                // Com abas, o "?" vai no topo do conteúdo da aba
                <GroupHelpLine
                  help={blockHelp(g.title, groupText, null)}
                  testID={`group-help-${g.id}`}
                />
              ) : echo ? (
                // O título da seção nomeia o bloco: o "?" vem logo abaixo, com
                // a frase do grupo e a da lista
                <GroupHelpLine
                  help={blockHelp(
                    listDef?.label ?? section.def.title,
                    groupText,
                    listText
                  )}
                  testID={`group-help-${g.id}`}
                />
              ) : null}
              {/* Na faixa fixa, o contador vai junto com as abas (T-27) */}
              {titled || tabs.inStrip ? null : (
                <CreationCounter fieldIds={g.fieldIds} line />
              )}
              {ids.length && filtered && ids.every(id => !isList(id)) ? (
                <ChipFlow ids={ids} />
              ) : ids.length ? (
                ids.map(id =>
                  badge && id === badged ? (
                    <View key={id}>
                      <FieldSlot id={id} variant="row" />
                      <RowBadge id={id} label={badge.label} />
                    </View>
                  ) : (
                    <FieldSlot key={id} id={id} variant="row" />
                  )
                )
              ) : (
                <Text color="inkMuted" style={styles.empty}>
                  {g.title
                    ? `Nada para mostrar em ${g.title}.`
                    : 'Nada para mostrar.'}
                </Text>
              )}
            </GroupBlock>
          )
        })}
      </View>
    </View>
  )
}

/** O bloco do grupo; a lista que o título já nomeia não repete o cabeçalho. */
function GroupBlock({
  headed,
  style,
  children,
}: {
  readonly headed: FieldId | undefined
  // A coluna do grupo no desktop (T-28)
  readonly style?: StyleProp<ViewStyle>
  readonly children: ReactNode
}) {
  return (
    <HeadedList.Provider value={headed}>
      <View style={style}>{children}</View>
    </HeadedList.Provider>
  )
}

// O selo da linha marcada: o nome do selo, nunca só a cor
function RowBadge({
  id,
  label,
}: {
  readonly id: string
  readonly label: string
}) {
  const { colors } = useTheme()
  return (
    <View testID={`badge-${id}`} style={styles.badgeRow}>
      <View style={[styles.badge, { borderColor: colors.action }]}>
        <Text variant="caption" color="action">
          {`◆ ${label}`}
        </Text>
      </View>
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
            { minHeight: hitTarget() },
            textStyle(theme, 'body'),
            { borderColor: colors.borderControl, color: colors.ink },
          ]}
        />
      ) : null}
    </View>
  )
}

// A coluna de um grupo no desktop (T-28): uma linha com controle (o rótulo,
// "−", o valor e "+", com a margem) precisa de ~290. Com o minColWidth do DS
// (240), os cinco grupos de Vantagens cabiam lado a lado a 1280 e o rótulo
// ficava com 48 px, quebrado no meio da palavra ("Corag em"). Com 320, a 1280
// eles ficam 3 + 2, e Atributos e Habilidades seguem em três colunas
export const GROUP_COL_MIN = 320

const styles = StyleSheet.create({
  flex: { flex: 1 },
  columns: { flexDirection: 'row', flexWrap: 'wrap' },
  column: {
    flexBasis: GROUP_COL_MIN,
    flexGrow: 1,
    minWidth: 0,
  },
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
  badgeRow: {
    flexDirection: 'row',
    paddingHorizontal: tokens.layout.gutter,
    paddingBottom: tokens.space[2],
  },
  badge: {
    borderRadius: tokens.radius.pill,
    borderWidth: tokens.borderWidth.hair,
    paddingHorizontal: tokens.space[2],
  },
  empty: {
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
  },
})
