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
  TabPanel,
  Text,
  ThemeProvider,
  tokens,
  useLayout,
  useTheme,
} from '@tms/ui'
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type HostInstance,
  Platform,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native'
import { useStore } from 'zustand'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { usePullRefresh } from '../lib/queries/focus'
import { ConflictBanner } from './ConflictBanner'
import { SheetProvider } from './context'
import {
  BonusNotice,
  CreationAlerts,
  CreationPanel,
  CreationStatusPanel,
  useCreating,
  useCreationReview,
} from './creation/CreationPanel'
import { type GuideTarget, MISSING_TARGET, POINTS_TAB } from './creation/guide'
import {
  CompletedWhileEditingBanner,
  ReturnedBanner,
} from './creation/ReturnedBanner'
import { DiceButton } from './dice'
import { canEditSomething } from './evolve/hooks'
import { ModeBarActions, type ModeBarParts, useModeBar } from './evolve/ModeBar'
import { IdentityBlock } from './IdentityBlock'
import { AnchorHeader } from './layouts/AnchorHeader'
import {
  type AnchorTarget,
  anchorDomId,
  focusView,
  offsetTopOf,
} from './layouts/anchor'
import {
  GroupTabsContext,
  SCROLL_ROOT,
  StripScope,
  useGroupTabsState,
} from './layouts/groupTabsState'
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
// Na criação por pontos, a conta ganha uma aba própria (Pontos), depois
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
      /**
       * "Puxar para atualizar" (P09-C, T-40): a rebusca da ficha. O que volta
       * passa pelo `received` do store, que confere a versão e o conflito
       * com o rascunho. Sem ele, sem o gesto.
       */
      readonly onRefresh?: () => unknown
    }
  | {
      readonly model: SheetModel
      readonly sheet: SheetData
      readonly roles: readonly RoleName[]
      readonly mode?: SheetMode
    }

const TAB_ZONES = new Set(['build', 'powers', 'lore'])
const BUDGET_TAB = POINTS_TAB

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
      onRefresh={'store' in props ? props.onRefresh : undefined}
    />
  )
}

/**
 * As partes da barra de modos, para quem escreve (T-27), e o `go` dela para a
 * barra do narrador, que fica no header (T-33). Quem não escreve fica sem o
 * `go`: sem "Editar como narrador".
 */
function ModeBarSlots({
  enabled,
  children,
}: {
  readonly enabled: boolean
  readonly children: (bar: ModeBarParts) => ReactNode
}) {
  const bar = useModeBar({ enabled })
  const actions = useMemo(
    () => (enabled ? { go: bar.go } : null),
    [enabled, bar.go]
  )
  return (
    <ModeBarActions.Provider value={actions}>
      {children(bar)}
    </ModeBarActions.Provider>
  )
}

function SheetBody({
  store,
  editable,
  header,
  onRefresh,
}: {
  readonly store: SheetStore
  readonly editable: boolean
  readonly header?: ReactNode
  readonly onRefresh?: () => unknown
}) {
  const pull = usePullRefresh(() => onRefresh?.())
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
  // T-33: a conta (aba Pontos) também em Leitura, para o narrador na ficha
  // alheia em criação por pontos; o que é de edição (o aviso de bônus, as
  // recusas e as "Regras da casa") continua só na Criação
  const narrator = roles.includes('storyteller') && !roles.includes('owner')
  const budgetEdit = editable && mode === 'create' && creating
  // P09-D (D-10): também em `pending`, para o narrador conferir a conta
  // antes de aprovar ou devolver (POA-20)
  const reviewing = useCreationReview()
  const budget =
    budgetEdit ||
    (editable && mode === 'read' && (creating || reviewing) && narrator)
  const onBudget = budget && tab === BUDGET_TAB
  const active: CompiledZone | undefined = onBudget
    ? undefined
    : (zones.find(z => z.id === tab) ?? zones[0])
  const tabs = [
    ...zones.map(z => ({ id: z.id, label: z.label ?? z.id })),
    ...(budget ? [{ id: BUDGET_TAB, label: 'Pontos' }] : []),
  ]
  // A aba do painel; sem ela entre as abas (nenhuma zona legível), o
  // conteúdo fica num contêiner comum, sem papel de painel
  const shownTab = onBudget ? BUDGET_TAB : active?.id
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
  // Trocar de aba com a faixa presa (rolado para dentro do painel): o painel
  // novo começa logo abaixo dela, não no fim de um conteúdo mais curto
  const scrollRef = useRef<ScrollViewInstance>(null)
  const showTab = useCallback(
    (id: string) => {
      setTab(id)
      const top = groupTabs.store.panelTop()
      if (groupTabs.store.scrollY() > top)
        scrollRef.current?.scrollTo({ y: top, animated: false })
    },
    [groupTabs.store]
  )
  // A troca de aba à mão esquece um "ir ao grupo" ainda pendente
  const selectTab = useCallback(
    (id: string) => {
      groupTabs.store.cancelJump()
      showTab(id)
    },
    [groupTabs.store, showTab]
  )
  // "Ver Pontos" nos avisos da recusa (T-07): só com a aba Pontos
  const openBudget = useMemo(
    () => (budget ? () => showTab(BUDGET_TAB) : null),
    [budget, showTab]
  )
  // O "ir ao grupo" do "O que falta" (P05-D, R-18): a aba, a sub-aba e a
  // âncora da seção (ou do grupo); a rolagem e o foco vêm quando a âncora é
  // medida (a aba nova ainda não foi desenhada). Fica na mesma tela: nada
  // vai para a URL nem para o histórico
  const tabIds = tabs.map(t => t.id).join(' ')
  const tabSet = useMemo(() => new Set(tabIds.split(' ')), [tabIds])
  const playRef = useRef<HostInstance>(null)
  const playTarget = useMemo(
    () => ({
      ref: playRef,
      nativeID: anchorDomId(PLAY_ANCHOR),
      tabIndex: -1 as const,
    }),
    []
  )
  // O "Em jogo" é alvo só quando está na rolagem (no Jogo do celular, ele
  // vira o dock)
  const playAnchored = play.length > 0 && !docked
  const goTo = useCallback(
    (target: GuideTarget | null) => {
      const anchors = groupTabs.store
      if (target?.tab === 'play' && playAnchored) {
        setPlayOpen(true)
        anchors.jumpTo([PLAY_ANCHOR])
        return
      }
      // Uma zona sem aba (a identidade) não tem âncora: a lista inteira, na
      // aba Pontos, em vez de um pedido que nunca se resolve
      const t = target && tabSet.has(target.tab) ? target : MISSING_TARGET
      if (!tabSet.has(t.tab)) return
      showTab(t.tab)
      const section = t.section ? model.sections.get(t.section) : undefined
      if (section?.def.groupTabs && t.group) anchors.select(section.id, t.group)
      anchors.jumpTo(
        [
          t.section && t.group ? `${t.section}/${t.group}` : null,
          t.section,
          t.tab === BUDGET_TAB ? 'creation-panel' : null,
        ].filter((id): id is string => Boolean(id))
      )
    },
    [groupTabs.store, model, showTab, tabSet, playAnchored]
  )
  // O painel e o "Em jogo" são remedidos no web quando o conteúdo da
  // rolagem muda de tamanho (A3); no app, o onLayout já avisa
  const panelRef = useRef<HostInstance>(null)
  const playBlockRef = useRef<HostInstance>(null)
  const placePlay = useCallback(
    (y: number) =>
      groupTabs.store.anchorAt(
        PLAY_ANCHOR,
        y,
        () => focusView(playRef.current),
        SCROLL_ROOT
      ),
    [groupTabs.store]
  )
  useEffect(() => {
    if (Platform.OS !== 'web') return
    return groupTabs.store.onRemeasure(() => {
      const panel = offsetTopOf(panelRef.current)
      if (panel !== null) groupTabs.store.panelAt(panel)
      const play = offsetTopOf(playBlockRef.current)
      if (play !== null) placePlay(play)
    })
  }, [groupTabs.store, placePlay])
  const { reduceMotion } = useTheme()
  useEffect(
    () =>
      groupTabs.store.onJump((y, focus) => {
        scrollRef.current?.scrollTo({ y, animated: !reduceMotion })
        focus?.()
      }),
    [groupTabs.store, reduceMotion]
  )
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
      editable ? <CompletedWhileEditingBanner key="completed" /> : null,
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
        <View
          key="play"
          ref={playBlockRef as never}
          onLayout={e => placePlay(e.nativeEvent.layout.y)}
        >
          {/* O alvo do foco é o próprio botão ou o título (P05-D) */}
          {collapsible ? (
            <PlayToggle
              open={playOpen}
              onToggle={() => setPlayOpen(v => !v)}
              target={playTarget}
            />
          ) : (
            <View style={styles.title}>
              <AnchorHeader title="Em jogo" level="group" target={playTarget} />
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
          onSelect={selectTab}
        />
      ) : null,
      <View
        key="panel"
        testID="sheet-panel"
        ref={panelRef as never}
        onLayout={e => groupTabs.store.panelAt(e.nativeEvent.layout.y)}
      >
        <StripScope.Provider value>
          {paneled && shownTab !== undefined ? (
            <TabPanel tabsId="sheet-parts" tab={shownTab}>
              {zoneContent}
            </TabPanel>
          ) : (
            zoneContent
          )}
        </StripScope.Provider>
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
            ref={scrollRef}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            stickyHeaderIndices={nav >= 0 ? [nav] : undefined}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={pull.refreshing}
                  onRefresh={pull.onRefresh}
                />
              ) : undefined
            }
            scrollEventThrottle={16}
            // A3: no web, o onLayout não avisa quando uma vista só desce
            // (o "Em jogo" abriu, um banner entrou): o conteúdo mudou de
            // tamanho, e as posições são lidas de novo
            onContentSizeChange={
              Platform.OS === 'web' ? groupTabs.store.remeasure : undefined
            }
            onScroll={e =>
              groupTabs.store.scrolled(e.nativeEvent.contentOffset.y)
            }
          >
            {items}
          </ScrollView>
        </KeyboardArea>
        {docked ? <CombatDock /> : null}
        {budgetEdit ? (
          <BonusNotice onBudget={() => showTab(BUDGET_TAB)} />
        ) : null}
      </View>
    )
  }

  return (
    <ThemeProvider skin={model.skin} accent={accent}>
      <SheetProvider store={store} openBudget={openBudget} goTo={goTo}>
        <FieldSheetProvider>
          <GroupTabsContext.Provider value={groupTabs}>
            {/* A barra de modos é da ficha viva (editable não muda numa ficha
              montada); quem não escreve, por papel ou pela política, fica
              sem as partes, e a ficha não remonta quando isso muda */}
            {editable ? (
              <ModeBarSlots enabled={writer}>
                {bar => screen(writer ? bar : null)}
              </ModeBarSlots>
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
const PLAY_ANCHOR = 'play'

/** O título "Em jogo" que abre e recolhe o bloco (T-59). */
function PlayToggle({
  open,
  onToggle,
  target,
}: {
  readonly open: boolean
  readonly onToggle: () => void
  // O alvo do "ir ao grupo": o botão já é focável, então só a ref e o id
  readonly target: AnchorTarget
}) {
  return (
    <Pressable
      ref={target.ref as never}
      nativeID={target.nativeID}
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
