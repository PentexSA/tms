import type { CompiledGroup, CompiledSection } from '@tms/sheet-core'
import { Tabs, tabPanelProps, tokens, useLayout } from '@tms/ui'
import { type ReactNode, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useGroupTabsContext } from './groupTabsState'

// `groupTabs` no template: no celular, os grupos da seção viram abas e só um
// aparece por vez (Físicos | Sociais | Mentais). Quem chama diz quando: no
// Editar, porque a linha com Stepper não cabe numa coluna; em Jogo e Leitura,
// só quando a seção mostra tudo em linhas (filtro desligado). A grade 3×3 e
// os chips do filtro cabem inteiros. Em telas largas, nada muda.
// `all` mostra todos os grupos, ignorando a aba (a busca procura em todos).
//
// Na ficha (com o provedor do SheetView), a escolha fica no contexto por
// ficha, e no celular a barra e o contador sobem para a faixa fixa (T-27):
// `bar` vem nulo, `inStrip` diz que a faixa os mostra, e o corpo continua
// filtrando pelo grupo escolhido.
export function useGroupTabs(
  section: CompiledSection,
  groups: readonly CompiledGroup[],
  {
    enabled,
    all = false,
  }: { readonly enabled: boolean; readonly all?: boolean }
): {
  readonly bar: ReactNode
  readonly groups: readonly CompiledGroup[]
  /** Props do contêiner dos grupos: o painel das abas (vazio sem abas). */
  readonly panelProps: ReturnType<typeof tabPanelProps> | Record<string, never>
  /** Os grupos estão em abas (no corpo ou na faixa). */
  readonly tabbed: boolean
  /** A faixa fixa mostra as abas e o contador do grupo. */
  readonly inStrip: boolean
} {
  const { breakpoint } = useLayout()
  const shared = useGroupTabsContext()
  const [local, setLocal] = useState(groups[0]?.id ?? '')
  const on =
    Boolean(section.def.groupTabs) &&
    enabled &&
    breakpoint === 'compact' &&
    groups.length > 1
  const tabsId = `groups-${section.id}`
  const inStrip = on && shared?.strip === true
  const register = shared?.register
  const title = section.def.title
  useEffect(() => {
    if (!inStrip || !register) return
    return register({ id: section.id, title, tabsId, groups })
  }, [inStrip, register, section.id, title, tabsId, groups])
  if (!on)
    return { bar: null, groups, panelProps: {}, tabbed: false, inStrip: false }
  const tab = shared ? (shared.selected[section.id] ?? '') : local
  const active = groups.find(g => g.id === tab) ?? groups[0]
  const bar = inStrip ? null : (
    <GroupTabsBar
      sectionId={section.id}
      title={title}
      groups={groups}
      selected={active?.id ?? ''}
      onSelect={id => (shared ? shared.select(section.id, id) : setLocal(id))}
    />
  )
  return {
    bar,
    groups: all || !active ? groups : [active],
    panelProps: tabPanelProps(tabsId, active?.id ?? ''),
    tabbed: true,
    inStrip,
  }
}

/** A barra das sub-abas de uma seção, no corpo ou na faixa fixa. */
export function GroupTabsBar({
  sectionId,
  title,
  groups,
  selected,
  onSelect,
}: {
  readonly sectionId: string
  readonly title: string
  readonly groups: readonly CompiledGroup[]
  readonly selected: string
  readonly onSelect: (groupId: string) => void
}) {
  return (
    <View style={styles.bar} testID={`group-tabs-${sectionId}`}>
      <Tabs
        id={`groups-${sectionId}`}
        size="sm"
        accessibilityLabel={`Grupos de ${title}`}
        items={groups.map(g => ({ id: g.id, label: g.title || g.id }))}
        selected={selected}
        onSelect={onSelect}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: tokens.layout.gutter,
    paddingBottom: tokens.space[1],
  },
})
