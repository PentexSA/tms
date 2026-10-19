import type { CompiledGroup } from '@tms/sheet-core'
import { SectionHeader, Text, tokens, useLayout } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useSheet } from '../context'
import { FieldSlot } from '../FieldSlot'
import { useGroupTabs } from './groupTabs'
import type { LayoutProps } from './types'

// Grade primária (DS: Grid / Cell): com grupos, cada grupo é uma coluna lida
// de cima para baixo (Atributos do WoD em 3×3, os 6 do D&D, as 8
// características do CoC). Com fonte grande ou tela estreita a grade vira
// lista (DS §10); em Evoluir no celular também, porque o Stepper não cabe
// numa coluna de 1/3. Com `groupTabs`, no celular cada grupo é uma aba.

export function GridLayout({ section }: LayoutProps) {
  const { mode } = useSheet()
  const { stacked, breakpoint } = useLayout()
  const groups: readonly CompiledGroup[] = section.groups ?? [
    { id: section.id, title: '', fieldIds: section.fieldIds },
  ]
  // Abas só no Editar: em Jogo e Leitura a grade cabe inteira
  const tabs = useGroupTabs(section, groups, { enabled: mode === 'evolve' })
  const columns =
    !tabs.bar && !stacked && !(mode === 'evolve' && breakpoint === 'compact')

  if (!columns)
    return (
      <View testID={`grid-${section.id}`}>
        {tabs.bar}
        {tabs.groups.map(g => (
          <View key={g.id}>
            {/* Com abas, o título do grupo é a própria aba */}
            {g.title && !tabs.bar ? (
              <View style={styles.title}>
                <SectionHeader title={g.title} level="group" />
              </View>
            ) : null}
            {g.fieldIds.map(id => (
              <FieldSlot key={id} id={id} variant="row" />
            ))}
          </View>
        ))}
      </View>
    )

  // Sem grupos: as células quebram em `columns` colunas (padrão 3)
  if (!section.groups) {
    const count = section.def.columns ?? 3
    return (
      <View testID={`grid-${section.id}`} style={styles.wrap}>
        {section.fieldIds.map(id => (
          <View key={id} style={{ width: `${100 / count}%` }}>
            <FieldSlot id={id} variant="cell" />
          </View>
        ))}
      </View>
    )
  }

  return (
    <View testID={`grid-${section.id}`} style={styles.columns}>
      {groups.map(g => (
        <View key={g.id} style={styles.column}>
          {/* O título do grupo é visual: cada célula já diz o próprio nome */}
          <Text
            variant="overline"
            color="inkMuted"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.head}
          >
            {g.title}
          </Text>
          {g.fieldIds.map(id => (
            <FieldSlot key={id} id={id} variant="cell" />
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: tokens.layout.gutter },
  columns: {
    flexDirection: 'row',
    paddingHorizontal: tokens.layout.gutter,
    gap: tokens.space[2],
  },
  column: { flex: 1, gap: tokens.space[1] },
  head: { paddingVertical: tokens.space[1] },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: tokens.layout.gutter,
  },
})
