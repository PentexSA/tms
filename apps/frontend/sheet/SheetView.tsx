import {
  type CompiledZone,
  canReadSection,
  identityOf,
  jsonEqual,
  type RoleName,
  type SheetData,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { SectionHeader, Tabs, ThemeProvider, tokens } from '@tms/ui'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { ConflictBanner } from './ConflictBanner'
import { SheetProvider } from './context'
import { IdentityBlock } from './IdentityBlock'
import { SectionView } from './SectionView'
import { createSheetStore, type SheetStore } from './store/sheetStore'

// A ficha montada pelo template (doc/arquitetura §6.1): identidade, "Em jogo"
// e as 3 abas fixas por zona (Ficha · Poderes · Sobre, com o rótulo do
// template). Aba sem seção legível some.
//
// Com `store`, é a ficha viva (otimista, fila, Desfazer). Com `sheet`, uma
// ficha só de leitura (prévias e testes).

export type SheetViewProps =
  | { readonly store: SheetStore }
  | {
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

export function SheetView(props: SheetViewProps) {
  const fixed = 'store' in props ? null : props
  const store = useMemo(
    () =>
      'store' in props
        ? props.store
        : createSheetStore({
            characterId: '',
            model: props.model,
            sheet: props.sheet,
            sheetVersion: 0,
            roles: props.roles,
            mode: props.mode,
          }),
    // Só leitura: uma ficha nova é um store novo
    [
      'store' in props ? props.store : null,
      fixed?.model,
      fixed?.sheet,
      fixed?.roles,
      fixed?.mode,
    ]
  )
  return <SheetBody store={store} />
}

function SheetBody({ store }: { readonly store: SheetStore }) {
  const { model, roles } = store.getState()
  const zones = useMemo(() => readableZones(model, roles), [model, roles])
  const [tab, setTab] = useState(zones[0]?.id ?? 'build')
  const active: CompiledZone | undefined =
    zones.find(z => z.id === tab) ?? zones[0]
  const play = model.zones.find(z => z.id === 'play')?.sections ?? []
  const accent = useStoreWithEqualityFn(
    store,
    s => identityOf(s.resolved).accent,
    jsonEqual
  )

  return (
    <ThemeProvider skin={model.skin} accent={accent}>
      <SheetProvider store={store}>
        <ScrollView contentContainerStyle={styles.content}>
          <ConflictBanner />
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
