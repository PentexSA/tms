import { type CompiledSection, canReadSection } from '@tms/sheet-core'
import { SectionHeader, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet } from './context'
import { CreationCounter } from './creation/CreationCounter'
import { layoutFor } from './layouts'
import { useGroupTabsContext } from './layouts/groupTabsState'

/**
 * Uma seção com título e layout. Seção que os papéis não leem não aparece
 * (o servidor já não mandou os valores; aqui some também o título).
 */
export function SectionView({
  section,
  hideTitle = false,
}: {
  readonly section: CompiledSection
  readonly hideTitle?: boolean
}) {
  const { model, roles } = useSheet()
  const shared = useGroupTabsContext()
  if (!canReadSection(model, section.id, roles)) return null
  const Layout = layoutFor(section.def.layout)
  // Com sub-abas, a seção diz onde começa: a faixa fixa mostra as abas da
  // seção que está no topo da tela (T-27)
  const reportsPlace = shared?.strip && section.def.groupTabs
  return (
    <View
      style={styles.section}
      testID={`section-${section.id}`}
      onLayout={
        reportsPlace
          ? e => shared.sectionAt(section.id, e.nativeEvent.layout.y)
          : undefined
      }
    >
      {hideTitle ? null : (
        <View style={styles.title}>
          <SectionHeader
            title={section.def.title}
            right={<CreationCounter fieldIds={section.fieldIds} />}
          />
        </View>
      )}
      <Layout section={section} />
    </View>
  )
}

const styles = StyleSheet.create({
  section: { paddingTop: tokens.space[4], gap: tokens.space[1] },
  title: { paddingHorizontal: tokens.layout.gutter },
})
