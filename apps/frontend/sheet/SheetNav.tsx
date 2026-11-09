import { Tabs, tokens, useTheme } from '@tms/ui'
import { useEffect, useMemo, useRef } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector } from './context'
import { CreationCounter } from './creation/CreationCounter'
import { basicsDone } from './creation/creation'
import {
  guideItems,
  nextTab,
  nextTabAnnouncement,
  pendingTabs,
} from './creation/guide'
import { GroupTabsBar } from './layouts/groupTabs'
import {
  useCurrentStripSection,
  useGroupTabsContext,
  useSelectedGroup,
} from './layouts/groupTabsState'

// A faixa de navegação fixa da ficha (T-27, parte 2; DS: SectionTabs). Fica
// presa no topo da rolagem (stickyHeaderIndices): as abas da zona ("Partes
// da ficha") em todos os tamanhos e, no celular, as sub-abas e o contador
// da seção com grupos que está no topo da tela. Assim "Pontos", as
// sub-abas e o contador ficam sempre a um toque, sem voltar ao topo.
//
// Leitor de tela e teclado: a faixa vem antes do conteúdo; as sub-abas
// mantêm o id (aria-controls aponta para o painel no corpo), "aba N de M" e
// as setas. A troca da seção atual não é anunciada.

type NavTab = { readonly id: string; readonly label: string }

/**
 * P17 (N-03): o selo "a seguir" na próxima aba com pendência quando a aba à
 * vista acaba (`nextTab`), e o anúncio quando ela acaba com o jogador nela:
 * não na montagem nem ao trocar de aba, e não na passagem em que o aviso dos
 * bônus abre (a folha já anuncia). Só na criação por pontos do dono.
 */
function useNextTab(
  tabs: readonly NavTab[],
  selected: string,
  guided: boolean
): string | null {
  const { model, roles } = useSheet()
  const check = useSheetSelector(s => s.check)
  const resolved = useSheetSelector(s => s.resolved)
  const items = useMemo(
    () => (guided ? guideItems(model, check, roles, resolved) : []),
    [guided, model, check, roles, resolved]
  )
  const next = nextTab({
    items,
    tabs,
    current: selected,
    freebies: check?.freebies ?? null,
    active: guided,
  })
  const label = next ? tabs.find(t => t.id === next.id)?.label : undefined
  const here = guided && pendingTabs(items, tabs).tabs.has(selected)
  const bonus = guided && basicsDone(check)
  const was = useRef<{
    readonly tab: string
    readonly here: boolean
    readonly bonus: boolean
  } | null>(null)
  useEffect(() => {
    const before = was.current
    was.current = { tab: selected, here, bonus }
    if (!before || before.tab !== selected || !before.here || here) return
    if (bonus && !before.bonus) return
    if (next && label)
      AccessibilityInfo.announceForAccessibility(
        nextTabAnnouncement(next.done, label)
      )
  }, [selected, here, bonus, next, label])
  return next?.id ?? null
}

export function SheetNav({
  tabs,
  selected,
  onSelect,
  guided = false,
}: {
  readonly tabs: readonly NavTab[]
  readonly selected: string
  readonly onSelect: (id: string) => void
  // A criação por pontos na tela do dono: o selo "a seguir" (P17, N-03)
  readonly guided?: boolean
}) {
  const { colors } = useTheme()
  const next = useNextTab(tabs, selected, guided)
  const items = useMemo(
    () =>
      next
        ? tabs.map(t => (t.id === next ? { ...t, attention: 'a seguir' } : t))
        : tabs,
    [tabs, next]
  )
  const shared = useGroupTabsContext()
  const store = shared?.store
  const strip = useCurrentStripSection(store)
  const current = shared?.strip ? strip : null
  const chosen = useSelectedGroup(store, current?.id)
  const active = current
    ? (current.groups.find(g => g.id === chosen) ?? current.groups[0])
    : undefined
  return (
    <View
      testID="sheet-nav"
      onLayout={e => store?.navHeight(e.nativeEvent.layout.height)}
      style={[
        styles.nav,
        { backgroundColor: colors.bg, borderBottomColor: colors.borderSubtle },
      ]}
    >
      {tabs.length ? (
        <Tabs
          id="sheet-parts"
          accessibilityLabel="Partes da ficha"
          items={items}
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
            onSelect={id => store?.select(current.id, id)}
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
