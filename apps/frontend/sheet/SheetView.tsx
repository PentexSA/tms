import {
  type CompiledZone,
  canReadSection,
  identityOf,
  type RoleName,
  resolve,
  type SheetData,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { SectionHeader, Tabs, ThemeProvider, tokens } from '@tms/ui'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SheetProvider } from './context'
import { IdentityBlock } from './IdentityBlock'
import { SectionView } from './SectionView'

// A ficha montada pelo template (doc/arquitetura §6.1): identidade, "Em jogo"
// e as 3 abas fixas por zona (Ficha · Poderes · Sobre, com o rótulo do
// template). Aba sem seção legível some.

export interface SheetViewProps {
  readonly model: SheetModel
  readonly sheet: SheetData
  readonly roles: readonly RoleName[]
  readonly mode?: SheetMode
}

const TAB_ZONES = new Set(['build', 'powers', 'lore'])

function readableZones(model: SheetModel, roles: readonly RoleName[]) {
  return model.zones.filter(
    z =>
      TAB_ZONES.has(z.id) &&
      z.sections.some(
        s => s.fieldIds.length > 0 && canReadSection(model, s.id, roles)
      )
  )
}

export function SheetView({
  model,
  sheet,
  roles,
  mode = 'read',
}: SheetViewProps) {
  const zones = useMemo(() => readableZones(model, roles), [model, roles])
  const [tab, setTab] = useState(zones[0]?.id ?? 'build')
  const active: CompiledZone | undefined =
    zones.find(z => z.id === tab) ?? zones[0]
  const play = model.zones.find(z => z.id === 'play')?.sections ?? []
  const accent = useMemo(
    () => identityOf(resolve(model, sheet)).accent,
    [model, sheet]
  )

  return (
    <ThemeProvider skin={model.skin} accent={accent}>
      <SheetProvider model={model} sheet={sheet} roles={roles} mode={mode}>
        <ScrollView contentContainerStyle={styles.content}>
          <IdentityBlock />
          {play.length ? (
            <View>
              <View style={styles.title}>
                <SectionHeader title="Em jogo" level="group" />
              </View>
              {play.map(s => (
                <SectionView key={s.id} section={s} hideTitle />
              ))}
            </View>
          ) : null}
          {zones.length ? (
            <View style={styles.tabs}>
              <Tabs
                accessibilityLabel="Partes da ficha"
                items={zones.map(z => ({ id: z.id, label: z.label ?? z.id }))}
                selected={active?.id ?? ''}
                onSelect={id => setTab(id as typeof tab)}
              />
            </View>
          ) : null}
          {active?.sections.map(s => (
            <SectionView
              key={s.id}
              section={s}
              hideTitle={active.sections.length === 1}
            />
          ))}
        </ScrollView>
      </SheetProvider>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: tokens.space[12] },
  title: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[4],
  },
  tabs: { marginTop: tokens.space[6] },
})
