import { Tabs, tokens, useTheme } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { CreationCounter } from './creation/CreationCounter'
import { GroupTabsBar } from './layouts/groupTabs'
import { useGroupTabsContext } from './layouts/groupTabsState'

// A faixa de navegação fixa da ficha (T-27, parte 2; DS: SectionTabs). Fica
// presa no topo da rolagem (stickyHeaderIndices): as abas da zona ("Partes
// da ficha") em todos os tamanhos e, no celular, as sub-abas e o contador
// da seção com grupos que está no topo da tela. Assim "Orçamento", as
// sub-abas e o contador ficam sempre a um toque, sem voltar ao topo.
//
// Leitor de tela e teclado: a faixa vem antes do conteúdo; as sub-abas
// mantêm o id (aria-controls aponta para o painel no corpo), "aba N de M" e
// as setas. A troca da seção atual não é anunciada.

export function SheetNav({
  tabs,
  selected,
  onSelect,
}: {
  readonly tabs: readonly { readonly id: string; readonly label: string }[]
  readonly selected: string
  readonly onSelect: (id: string) => void
}) {
  const { colors } = useTheme()
  const shared = useGroupTabsContext()
  const current = shared?.strip ? shared.current : null
  const active = current
    ? (current.groups.find(g => g.id === shared?.selected[current.id]) ??
      current.groups[0])
    : undefined
  return (
    <View
      testID="sheet-nav"
      onLayout={e => shared?.navHeight(e.nativeEvent.layout.height)}
      style={[
        styles.nav,
        { backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle },
      ]}
    >
      {tabs.length ? (
        <Tabs
          id="sheet-parts"
          accessibilityLabel="Partes da ficha"
          items={tabs}
          selected={selected}
          onSelect={onSelect}
        />
      ) : null}
      {current && active ? (
        <View style={styles.groups}>
          <GroupTabsBar
            sectionId={current.id}
            title={current.title}
            groups={current.groups}
            selected={active.id}
            onSelect={id => shared?.select(current.id, id)}
          />
          <CreationCounter fieldIds={active.fieldIds} line />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  nav: { borderBottomWidth: tokens.borderWidth.hair },
  groups: { paddingTop: tokens.space[2] },
})
