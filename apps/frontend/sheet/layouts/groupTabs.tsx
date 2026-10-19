import type { CompiledGroup, CompiledSection } from '@tms/sheet-core'
import { Tabs, tokens, useLayout } from '@tms/ui'
import { type ReactNode, useState } from 'react'
import { StyleSheet, View } from 'react-native'

// `groupTabs` no template: no celular, os grupos da seção viram abas e só um
// aparece por vez (Físicos | Sociais | Mentais). Em telas largas, nada muda.
// `all` mostra todos os grupos, ignorando a aba (a busca procura em todos).
export function useGroupTabs(
  section: CompiledSection,
  groups: readonly CompiledGroup[],
  all = false
): { readonly bar: ReactNode; readonly groups: readonly CompiledGroup[] } {
  const { breakpoint } = useLayout()
  const [tab, setTab] = useState(groups[0]?.id ?? '')
  const on =
    Boolean(section.def.groupTabs) &&
    breakpoint === 'compact' &&
    groups.length > 1
  if (!on) return { bar: null, groups }
  const active = groups.find(g => g.id === tab) ?? groups[0]
  const bar = (
    <View style={styles.bar} testID={`group-tabs-${section.id}`}>
      <Tabs
        size="sm"
        accessibilityLabel={`Grupos de ${section.def.title}`}
        items={groups.map(g => ({ id: g.id, label: g.title || g.id }))}
        selected={active?.id ?? ''}
        onSelect={setTab}
      />
    </View>
  )
  return { bar, groups: all || !active ? groups : [active] }
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: tokens.layout.gutter,
    paddingBottom: tokens.space[1],
  },
})
