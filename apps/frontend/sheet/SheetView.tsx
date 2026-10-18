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
import { SectionHeader, Tabs, ThemeProvider, tokens, useLayout } from '@tms/ui'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useStore } from 'zustand'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { ConflictBanner } from './ConflictBanner'
import { SheetProvider } from './context'
import { canEditSomething } from './evolve/hooks'
import { ModeBar } from './evolve/ModeBar'
import { IdentityBlock } from './IdentityBlock'
import { ActionsButton } from './play/ActionsMenu'
import { CombatDock, dockFields } from './play/CombatDock'
import { FieldSheetProvider } from './play/FieldSheet'
import { SectionView } from './SectionView'
import { createSheetStore, type SheetStore } from './store/sheetStore'

// A ficha montada pelo template (doc/arquitetura §6.1): identidade, "Em jogo"
// e as 3 abas fixas por zona (Ficha · Poderes · Sobre, com o rótulo do
// template). Aba sem seção legível some.
//
// Em Jogo, no celular (compact), o "Em jogo" vira o CombatDock fixo embaixo;
// a partir de 600 o dock some e a seção mostra os mesmos campos (design
// system: CombatDock). O menu ⋯ tem as ações do template.
//
// Com `store`, é a ficha viva (otimista, fila, Desfazer). Com `sheet`, uma
// ficha só de leitura (prévias e testes). `editable` mostra os modos
// (Leitura · Jogo · Evoluir) para quem escreve algum campo.

export type SheetViewProps =
  | { readonly store: SheetStore; readonly editable?: boolean }
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
  const editable = 'store' in props && props.editable === true
  return <SheetBody store={store} editable={editable} />
}

function SheetBody({
  store,
  editable,
}: {
  readonly store: SheetStore
  readonly editable: boolean
}) {
  const { model, roles } = store.getState()
  const zones = useMemo(() => readableZones(model, roles), [model, roles])
  const writer = useMemo(
    () => editable && canEditSomething(model, new Set(roles)),
    [editable, model, roles]
  )
  const [tab, setTab] = useState(zones[0]?.id ?? 'build')
  const active: CompiledZone | undefined =
    zones.find(z => z.id === tab) ?? zones[0]
  const play = model.zones.find(z => z.id === 'play')?.sections ?? []
  const accent = useStoreWithEqualityFn(
    store,
    s => identityOf(s.resolved).accent,
    jsonEqual
  )
  const mode = useStore(store, s => s.mode)
  const { breakpoint } = useLayout()
  const docked =
    mode === 'play' &&
    breakpoint === 'compact' &&
    dockFields(model, new Set(roles)).length > 0

  return (
    <ThemeProvider skin={model.skin} accent={accent}>
      <SheetProvider store={store}>
        <FieldSheetProvider>
          <View style={styles.screen}>
            {writer ? <ModeBar /> : null}
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <ConflictBanner />
              {mode === 'play' ? (
                <View style={styles.toolbar}>
                  <ActionsButton />
                </View>
              ) : null}
              <IdentityBlock />
              {play.length && !docked ? (
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
                    items={zones.map(z => ({
                      id: z.id,
                      label: z.label ?? z.id,
                    }))}
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
            {docked ? <CombatDock /> : null}
          </View>
        </FieldSheetProvider>
      </SheetProvider>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: tokens.layout.gutter,
  },
  content: { paddingBottom: tokens.space[12] },
  title: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[4],
  },
  tabs: { marginTop: tokens.space[6] },
})
