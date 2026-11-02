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
import {
  KeyboardArea,
  Pressable,
  SectionHeader,
  TabPanel,
  Text,
  ThemeProvider,
  tokens,
  useLayout,
  useTheme,
} from '@tms/ui'
import { type ReactElement, type ReactNode, useMemo, useState } from 'react'
import { Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useStore } from 'zustand'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { ConflictBanner } from './ConflictBanner'
import { SheetProvider } from './context'
import {
  BonusNotice,
  CreationAlerts,
  CreationPanel,
  CreationStatusPanel,
  useCreating,
} from './creation/CreationPanel'
import { ReturnedBanner } from './creation/ReturnedBanner'
import { DiceButton } from './dice'
import { canEditSomething } from './evolve/hooks'
import { type ModeBarParts, useModeBar } from './evolve/ModeBar'
import { IdentityBlock } from './IdentityBlock'
import { GroupTabsContext, useGroupTabsState } from './layouts/groupTabsState'
import { PolicyBanner } from './PolicyBanner'
import { ActionsButton } from './play/ActionsMenu'
import { CombatDock, dockFields } from './play/CombatDock'
import { FieldSheetProvider } from './play/FieldSheet'
import { blockedBy, useLifecycle } from './policy'
import { SectionView } from './SectionView'
import { SheetNav } from './SheetNav'
import { createSheetStore, type SheetStore } from './store/sheetStore'

// A ficha montada pelo template (doc/arquitetura §6.1): identidade, "Em jogo"
// e as 3 abas fixas por zona (Ficha · Poderes · Sobre, com o rótulo do
// template). Aba sem seção legível some.
//
// Na criação por pontos, a conta ganha uma aba própria (Orçamento), depois
// das da ficha: a distribuição fica nas abas, a conta não empurra a ficha.
//
// Em Jogo, no celular (compact), o "Em jogo" vira o CombatDock fixo embaixo;
// a partir de 600 o dock some e a seção mostra os mesmos campos (design
// system: CombatDock). O menu ⋯ tem as ações do template.
//
// Com `store`, é a ficha viva (otimista, fila, Desfazer). Com `sheet`, uma
// ficha só de leitura (prévias e testes). `editable` mostra os modos
// (Leitura · Jogo · Evoluir) para quem escreve algum campo.

export type SheetViewProps =
  | {
      readonly store: SheetStore
      readonly editable?: boolean
      /**
       * O que vem acima da ficha (o painel do NPC e a barra do narrador).
       * Fora do celular, fica fixo, como antes; no celular, rola com a ficha
       * (T-27).
       */
      readonly header?: ReactNode
    }
  | {
      readonly model: SheetModel
      readonly sheet: SheetData
      readonly roles: readonly RoleName[]
      readonly mode?: SheetMode
    }

const TAB_ZONES = new Set(['build', 'powers', 'lore'])
const BUDGET_TAB = 'creation'

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
  return (
    <SheetBody
      store={store}
      editable={editable}
      header={'store' in props ? props.header : undefined}
    />
  )
}

/** As partes da barra de modos, para quem escreve (T-27). */
function ModeBarSlots({
  children,
}: {
  readonly children: (bar: ModeBarParts) => ReactNode
}) {
  return children(useModeBar())
}

function SheetBody({
  store,
  editable,
  header,
}: {
  readonly store: SheetStore
  readonly editable: boolean
  readonly header?: ReactNode
}) {
  const { model, roles } = store.getState()
  const zones = useMemo(() => readableZones(model, roles), [model, roles])
  const lifecycle = useLifecycle()
  // Travada ou arquivada, o dono não muda de modo: a política tirou o Editar
  const writer = useMemo(
    () =>
      editable &&
      canEditSomething(model, new Set(roles)) &&
      !blockedBy(new Set(roles), lifecycle, 'edit'),
    [editable, model, roles, lifecycle]
  )
  const [tab, setTab] = useState<string>(zones[0]?.id ?? 'build')
  const mode = useStore(store, s => s.mode)
  const creating = useCreating()
  const budget = editable && mode === 'create' && creating
  const onBudget = budget && tab === BUDGET_TAB
  const active: CompiledZone | undefined = onBudget
    ? undefined
    : (zones.find(z => z.id === tab) ?? zones[0])
  const tabs = [
    ...zones.map(z => ({ id: z.id, label: z.label ?? z.id })),
    ...(budget ? [{ id: BUDGET_TAB, label: 'Orçamento' }] : []),
  ]
  // A aba do painel; sem ela entre as abas (nenhuma zona legível), o
  // conteúdo fica num contêiner comum, sem papel de painel
  const shownTab = onBudget ? BUDGET_TAB : active?.id
  // "Ver orçamento" nos avisos da recusa (T-07): só com a aba Orçamento
  const openBudget = useMemo(
    () => (budget ? () => setTab(BUDGET_TAB) : null),
    [budget]
  )
  const paneled = shownTab !== undefined && tabs.some(t => t.id === shownTab)
  const zoneContent = (
    <>
      {onBudget ? <CreationPanel /> : null}
      {active?.sections.map(s => (
        <SectionView
          key={s.id}
          section={s}
          hideTitle={active.sections.length === 1}
        />
      ))}
    </>
  )
  const play = model.zones.find(z => z.id === 'play')?.sections ?? []
  const accent = useStoreWithEqualityFn(
    store,
    s => identityOf(s.resolved).accent,
    jsonEqual
  )
  const { breakpoint } = useLayout()
  const docked =
    mode === 'play' &&
    breakpoint === 'compact' &&
    dockFields(model, new Set(roles)).length > 0
  // T-59: na Criação, "Em jogo" começa recolhido (os Atributos ficam na
  // primeira dobra) e abre com um toque; nos outros modos, aberto como antes
  const collapsible = mode === 'create'
  const [playOpen, setPlayOpen] = useState(false)
  // T-27: no celular, o painel do NPC, a barra do narrador e o seletor de
  // modo rolam com a ficha; a barra de ação (onde se salva e conclui) fica
  // fixa. Fora do celular, tudo fixo acima, como antes.
  const phone = breakpoint === 'compact'
  const groupTabs = useGroupTabsState(phone)
  // O header (painel do NPC e barra do narrador) é do app, não da ficha:
  // fica com o tema de fora (a skin do app e o accent neutro), mesmo quando
  // rola dentro da ficha, que usa a skin e o accent do personagem
  const appSkin = useTheme().skin
  const chrome = header ? (
    <ThemeProvider skin={appSkin} accent="accent-neutral">
      {header}
    </ThemeProvider>
  ) : null

  // T-27 (parte 2): os filhos da rolagem num array sem nulos, porque o
  // stickyHeaderIndices conta posições; a faixa de navegação fica presa no
  // topo. No celular, ela leva as sub-abas e o contador da seção atual
  const scrollItems = (bar: ModeBarParts | null): ReactElement[] => {
    const items: (ReactElement | null | false)[] = [
      phone && (header || bar) ? (
        <View key="head" testID="sheet-scroll-header">
          {chrome}
          {bar?.switcher}
        </View>
      ) : null,
      <ConflictBanner key="conflict" />,
      editable ? <PolicyBanner key="policy" /> : null,
      editable ? <CreationStatusPanel key="status" /> : null,
      // A devolução aparece em qualquer modo (T-06)
      editable ? <ReturnedBanner key="returned" /> : null,
      editable && mode === 'create' ? <CreationAlerts key="alerts" /> : null,
      mode === 'play' ? (
        <View key="toolbar" style={styles.toolbar}>
          {/* Some quando o template não tem rolagem (D&D, CoC, Fate) */}
          <DiceButton
            characterId={store.getState().characterId}
            store={store}
          />
          <ActionsButton />
        </View>
      ) : null,
      <IdentityBlock key="identity" />,
      play.length && !docked ? (
        <View key="play">
          {collapsible ? (
            <PlayToggle open={playOpen} onToggle={() => setPlayOpen(v => !v)} />
          ) : (
            <View style={styles.title}>
              <SectionHeader title="Em jogo" level="group" />
            </View>
          )}
          {!collapsible || playOpen ? (
            <View nativeID={PLAY_ID}>
              {play.map(s => (
                <SectionView key={s.id} section={s} hideTitle />
              ))}
            </View>
          ) : null}
        </View>
      ) : null,
      tabs.length || phone ? (
        <View key="nav-gap" style={styles.navGap} />
      ) : null,
      tabs.length || phone ? (
        <SheetNav
          key="nav"
          tabs={tabs}
          selected={shownTab ?? ''}
          onSelect={setTab}
        />
      ) : null,
      <View
        key="panel"
        testID="sheet-panel"
        onLayout={e => groupTabs.store.panelAt(e.nativeEvent.layout.y)}
      >
        {paneled && shownTab !== undefined ? (
          <TabPanel tabsId="sheet-parts" tab={shownTab}>
            {zoneContent}
          </TabPanel>
        ) : (
          zoneContent
        )}
      </View>,
    ]
    return items.filter((i): i is ReactElement => Boolean(i))
  }

  const screen = (bar: ModeBarParts | null) => {
    const items = scrollItems(bar)
    const nav = items.findIndex(i => i.key === 'nav')
    return (
      <View style={styles.screen}>
        {phone ? null : chrome}
        {bar && !phone ? (
          <View>
            {bar.switcher}
            {bar.actionBar}
          </View>
        ) : null}
        {bar && phone ? bar.actionBar : null}
        {bar?.summary}
        {/* Só a rolagem encolhe acima do teclado (T-26): o campo do
            "Digitar", a busca e os textos ficam à vista; o dock e o
            aviso de bônus ficam atrás do teclado enquanto ele está
            aberto */}
        <KeyboardArea>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            stickyHeaderIndices={nav >= 0 ? [nav] : undefined}
            scrollEventThrottle={16}
            onScroll={
              phone
                ? e => groupTabs.store.scrolled(e.nativeEvent.contentOffset.y)
                : undefined
            }
          >
            {items}
          </ScrollView>
        </KeyboardArea>
        {docked ? <CombatDock /> : null}
        {budget ? <BonusNotice onBudget={() => setTab(BUDGET_TAB)} /> : null}
      </View>
    )
  }

  return (
    <ThemeProvider skin={model.skin} accent={accent}>
      <SheetProvider store={store} openBudget={openBudget}>
        <FieldSheetProvider>
          <GroupTabsContext.Provider value={groupTabs}>
            {/* A barra de modos é da ficha viva (editable não muda numa ficha
              montada); quem não escreve, por papel ou pela política, fica
              sem as partes, e a ficha não remonta quando isso muda */}
            {editable ? (
              <ModeBarSlots>{bar => screen(writer ? bar : null)}</ModeBarSlots>
            ) : (
              screen(null)
            )}
          </GroupTabsContext.Provider>
        </FieldSheetProvider>
      </SheetProvider>
    </ThemeProvider>
  )
}

const PLAY_ID = 'sheet-play'

/** O título "Em jogo" que abre e recolhe o bloco (T-59). */
function PlayToggle({
  open,
  onToggle,
}: {
  readonly open: boolean
  readonly onToggle: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Em jogo"
      accessibilityState={{ expanded: open }}
      aria-expanded={open}
      {...(Platform.OS === 'web' ? { 'aria-controls': PLAY_ID } : {})}
      testID="play-toggle"
      onPress={onToggle}
      style={styles.toggle}
    >
      <Text variant="title" style={styles.toggleText}>
        Em jogo
      </Text>
      <Text variant="caption" color="inkMuted" aria-hidden>
        {open ? '▾' : '▸'}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[4],
    paddingBottom: tokens.space[2],
  },
  toggleText: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
  },
  content: { paddingBottom: tokens.space[12] },
  title: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[4],
  },
  navGap: { height: tokens.space[6] },
})
