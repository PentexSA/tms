import { useQueryClient } from '@tanstack/react-query'
import {
  isDraftMode,
  jsonEqual,
  type RoleName,
  type SheetMode,
  xpLedgerFields,
} from '@tms/sheet-core'
import {
  AppBar,
  Avatar,
  Button,
  Choice,
  EmptyState,
  Screen,
  Skeleton,
  Text,
  TextField,
  tokens,
  useLayout,
  useToast,
} from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf, statusOf } from '../lib/errors'
import {
  useSetNpcPresentation,
  useSetNpcVisibility,
} from '../lib/queries/chronicles'
import { useRefetchOnFocus } from '../lib/queries/focus'
import { CreationContext } from './creation/CreationContext'
import {
  completionFreebies,
  creationActive,
  creationInfoOf,
  creationInputOf,
  freebiesNotes,
} from './creation/creation'
import { DraftRecovery, useDraftPersistence } from './DraftRecovery'
import { type SheetState, sheetKeys, useSheetData } from './data'
import { canEditSomething } from './evolve/hooks'
import { LeaveGuard } from './evolve/LeaveGuard'
import { HistorySheet } from './history/HistorySheet'
import { blockedBy, LifecycleContext, type SheetLifecycle } from './policy'
import { SheetMenu } from './SheetMenu'
import { SheetView } from './SheetView'
import {
  createSheetStore,
  type SheetState as SheetStoreState,
} from './store/sheetStore'
import {
  lowerDone,
  type NpcVisibility,
  npcVisibilityOf,
  REVEAL_COPY,
  type Reveal,
  RevealNpcSheet,
  revealsMore,
} from './storyteller/RevealNpcSheet'
import {
  StatusMenuButton,
  type StatusMenuDraft,
  type StatusMenuTarget,
} from './storyteller/StatusMenu'
import { StorytellerBar } from './storyteller/StorytellerBar'
import { SwipeArea, TableNav } from './storyteller/TableNav'
import { OfflineBanner, SyncIndicator } from './sync/SyncIndicator'
import { useSync } from './sync/SyncProvider'
import { UnsupportedTemplate } from './UnsupportedTemplate'
import { ExperienceSheet } from './xp/ExperienceSheet'

export function SheetScreen({
  id,
  initialMode,
}: {
  readonly id: string
  // A ficha recém-criada abre em Evoluir (Etapa 18), ou na Criação quando a
  // conta por pontos vale (v4)
  readonly initialMode?: SheetMode
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const sync = useSync()
  const state = useSheetData(id)
  const [history, setHistory] = useState(false)
  const [xp, setXp] = useState(false)
  // T-11: abaixo de 900, as ações do cabeçalho não cabem lado a lado e
  // ficam no "Mais opções"; a partir de 900, como antes
  const wide = useLayout().breakpoint === 'expanded'
  // O rascunho aberto, para o cabeçalho, que fica fora do store: as
  // alterações não salvas (T-17: o cabeçalho não diz "Salvo"; T-32: o menu
  // do narrador não conclui por cima delas)
  const [draftState, setDraftState] = useState<DraftState>(NO_DRAFT)
  const unsaved = draftState.unsaved
  // T-18: a sobra de bônus na confirmação de concluir pelo menu do narrador
  const completionNotes = useMemo(
    () => freebiesNotes(draftState.freebiesLeft),
    [draftState.freebiesLeft]
  )
  // O que concluir pelo menu do narrador precisa (T-32, T-18): a revisão, a
  // versão e o rascunho aberto, no botão largo e no "Mais opções"
  const info = state.status === 'ready' ? state.character.creation : undefined
  const sheetVersion =
    state.status === 'ready' ? state.character.sheetVersion : undefined
  const creation = useMemo(() => creationInfoOf(info), [info])
  const draft = useMemo<StatusMenuDraft>(
    () => ({
      revision: creation?.revision,
      sheetVersion,
      approval: creation?.approval,
      unsaved,
      queued: draftState.queued,
      notes: completionNotes,
    }),
    [creation, sheetVersion, unsaved, draftState.queued, completionNotes]
  )
  // Sem tempo real: voltar para a ficha rebusca (e o histórico, que é filho)
  useRefetchOnFocus(() =>
    queryClient.invalidateQueries(
      { queryKey: sheetKeys.character(id) },
      { cancelRefetch: false }
    )
  )
  useEffect(() => {
    if (state.status === 'error' && statusOf(state.error) === 404) {
      queryClient.removeQueries({ queryKey: sheetKeys.character(id) })
      // Sem acesso à ficha: o rascunho guardado dela também sai (T-03)
      void sync.drafts.remove(id).catch(() => undefined)
    }
  }, [id, queryClient, state, sync])
  // O NPC com a identidade revelada também volta para a crônica dele (T-81)
  const chronicle =
    state.status === 'ready' ||
    state.status === 'viewer' ||
    state.status === 'identity'
      ? (state.character.chronicle ?? null)
      : null
  const back = chronicle
    ? {
        label: chronicle.name,
        onPress: () => router.replace(`/chronicles/${chronicle.id}`),
      }
    : { label: 'Crônicas', onPress: () => router.replace('/') }
  const title =
    state.status === 'ready'
      ? state.character.name
      : state.status === 'identity' || state.status === 'viewer'
        ? state.character.identity.name
        : 'Ficha'

  let body: React.JSX.Element
  switch (state.status) {
    case 'loading':
      body = <Skeleton lines={6} label="Carregando a ficha" />
      break
    case 'unsupported':
      body = <UnsupportedTemplate onBack={back.onPress} />
      break
    case 'invalid':
      body = (
        <EmptyState
          title="Não foi possível abrir a ficha"
          message="Os dados desta ficha não passaram na validação do sistema."
        />
      )
      break
    case 'identity':
      body = <IdentityProjection character={state.character} />
      break
    case 'viewer':
      // T-15: no nativo (Yoga), o filho com flex 1 num pai de altura
      // automática fica com altura 0, e só o aviso aparecia. O contêiner
      // ocupa a tela: o aviso fica em cima e a ficha rola embaixo.
      body = (
        <View style={styles.viewer} testID="viewer-sheet">
          <View style={styles.readNotice}>
            <Text variant="fieldLabel">Leitura</Text>
            <Text color="inkMuted">
              Esta ficha foi revelada pelo narrador. Notas e ações privadas não
              fazem parte desta projeção.
            </Text>
          </View>
          <SheetView
            model={state.model}
            sheet={state.sheet}
            roles={state.roles}
            mode="read"
          />
        </View>
      )
      break
    case 'error':
      body =
        statusOf(state.error) === 404 ? (
          <EmptyState
            title="Você não tem acesso a esta ficha"
            message="Ela não existe, foi excluída ou é de uma crônica de que você não participa."
          />
        ) : (
          <EmptyState
            title="Não foi possível carregar a ficha"
            message={messageOf(state.error)}
            actions={<Button title="Tentar de novo" onPress={state.retry} />}
          />
        )
      break
    case 'ready':
      // Outra versão do template ou outros papéis: outro store
      body = (
        <LiveSheet
          key={`${state.character.templateVersion}:${state.roles.join(',')}`}
          state={state}
          initialMode={initialMode}
          onDraftState={setDraftState}
        />
      )
  }

  return (
    <Screen>
      <AppBar
        title={title}
        back={back}
        actions={
          <View style={styles.actions}>
            {/* Só com a ficha aberta: nada de "Salvo" na tela sem acesso */}
            {state.status === 'ready' ? (
              <SyncIndicator unsaved={unsaved} />
            ) : null}
            {state.status !== 'ready' ? null : wide ? (
              <>
                {state.roles.includes('storyteller') ? (
                  <StatusMenuButton {...narratorOf(id, state)} {...draft} />
                ) : null}
                {xpLedgerFields(state.model).length ? (
                  <Button
                    title="Experiência"
                    variant="ghost"
                    testID="xp-open"
                    accessibilityHint="Abre o saldo, os pedidos e o extrato de XP"
                    onPress={() => setXp(true)}
                  />
                ) : null}
                <Button
                  title="Histórico"
                  variant="ghost"
                  accessibilityHint="Abre o histórico de alterações da ficha"
                  onPress={() => setHistory(true)}
                />
              </>
            ) : (
              <SheetMenu
                narrator={
                  state.roles.includes('storyteller')
                    ? narratorOf(id, state)
                    : null
                }
                draft={draft}
                onExperience={
                  xpLedgerFields(state.model).length ? () => setXp(true) : null
                }
                onHistory={() => setHistory(true)}
              />
            )}
          </View>
        }
      />
      <OfflineBanner />
      {state.status === 'ready' && state.roles.includes('storyteller') ? (
        // Vindo da Mesa, o narrador passa de uma ficha a outra deslizando
        <SwipeArea characterId={id}>
          <TableNav characterId={id} />
          {body}
        </SwipeArea>
      ) : (
        body
      )}
      {state.status === 'ready' && xp ? (
        <ExperienceSheet
          characterId={id}
          chronicleId={state.character.chronicle.id}
          model={state.model}
          sheet={state.sheet}
          roles={state.roles}
          lifecycle={{
            status: state.character.status,
            locked: state.character.lockedAt !== null,
            member: state.character.member,
          }}
          visible={xp}
          onClose={() => setXp(false)}
        />
      ) : null}
      {state.status === 'ready' ? (
        <HistorySheet
          characterId={id}
          chronicleId={state.character.chronicle.id}
          characterName={state.character.name}
          model={state.model}
          storyteller={state.roles.includes('storyteller')}
          visible={history}
          onClose={() => setHistory(false)}
        />
      ) : null}
    </Screen>
  )
}

/** De qual ficha são as ações do narrador (botão largo e SheetMenu). */
function narratorOf(
  id: string,
  state: Extract<SheetState, { status: 'ready' }>
): StatusMenuTarget {
  return {
    characterId: id,
    chronicleId: state.character.chronicle.id,
    model: state.model,
    status: state.character.status,
    locked: state.character.lockedAt !== null,
  }
}

/**
 * O dono abre a própria ficha em Jogo; os demais (narrador, outros jogadores),
 * em Leitura. É UX: quem decide se a escrita vale é o servidor.
 */
export const defaultMode = (roles: readonly RoleName[]): SheetMode =>
  roles.includes('owner') ? 'play' : 'read'

/**
 * O modo em que a ficha abre sem pedido na URL (T-05): a ficha em criação da
 * dona abre na montagem, por qualquer entrada (lista, link, recarga, troca de
 * estado). Criação quando a conta por pontos vale; Editar na criação livre.
 * Nos demais casos, o padrão do papel. O narrador, na ficha alheia, continua
 * em Leitura; o NPC dele nasce em criação livre e pode ficar assim em jogo,
 * então também não muda. É UX: o servidor valida cada escrita.
 */
export function openingMode(args: {
  readonly roles: readonly RoleName[]
  readonly status: string
  readonly active: boolean
  readonly writer: boolean
  readonly npc?: boolean
}): SheetMode {
  const { roles, status, active, writer, npc = false } = args
  if (status === 'creating' && writer && !npc && roles.includes('owner'))
    return active ? 'create' : 'evolve'
  return defaultMode(roles)
}

/**
 * O modo que a política deixa, quando ela tira algum (doc/plano-v3.md, Etapa
 * 6): travada, a ficha fica em Jogo sem nada editável (a rolagem sem custo
 * continua); arquivada, fora de jogo ou de quem saiu, em Leitura. Null: o
 * modo é livre.
 */
export function policyMode(
  roles: readonly RoleName[],
  lifecycle: SheetLifecycle
): Exclude<SheetMode, 'evolve'> | null {
  const code = blockedBy(new Set(roles), lifecycle, 'play')
  if (!code) return null
  return code === 'SHEET_LOCKED' ? 'play' : 'read'
}

/**
 * O que o cabeçalho sabe do rascunho aberto e da conta da criação. O menu do
 * narrador fica no AppBar, fora do SheetProvider: é por aqui que ele sabe.
 */
export interface DraftState {
  // Alterações não salvas
  readonly unsaved: number
  // Lotes salvos ainda na fila, sem confirmação do servidor
  readonly queued: number
  // A sobra de bônus na hora de concluir (T-18), para a confirmação do menu
  // do narrador: só para o narrador e só com a conta fechada (a conta vale
  // na criação por pontos, em creating e pending, em qualquer modo). Null no
  // resto: sem linha, e o jogador não re-renderiza a tela a cada bônus
  readonly freebiesLeft: number | null
}

const NO_DRAFT: DraftState = { unsaved: 0, queued: 0, freebiesLeft: null }

const draftStateOf = (
  s: SheetStoreState,
  storyteller: boolean
): DraftState => ({
  unsaved: s.draft?.size ?? 0,
  queued: s.pending.length,
  freebiesLeft: storyteller ? completionFreebies(s.check) : null,
})

/** A ficha viva: store por ficha, ligado à fila e à ficha do cache. */
function LiveSheet({
  state,
  initialMode,
  onDraftState,
}: {
  readonly state: Extract<SheetState, { status: 'ready' }>
  readonly initialMode?: SheetMode
  readonly onDraftState?: (draft: DraftState) => void
}) {
  const sync = useSync()
  const toast = useToast()
  const { id, sheet, sheetVersion, status, lockedAt, member } = state.character
  const lifecycle = useMemo<SheetLifecycle>(
    () => ({ status, locked: lockedAt !== null, member }),
    [status, lockedAt, member]
  )
  const forced = policyMode(state.roles, lifecycle)
  // A criação por pontos (doc/plano-v4.md, Etapa 5): a conta vale em
  // creating e pending; o store recebe a entrada da conta (contadores e
  // avaliação parcial antes de enfileirar)
  const info = useMemo(
    () => creationInfoOf(state.character.creation),
    [state.character.creation]
  )
  const active = creationActive(info, status)
  const inputJson =
    active && info ? JSON.stringify(creationInputOf(info)) : null
  const creation = useMemo(
    () => (inputJson ? JSON.parse(inputJson) : null),
    [inputJson]
  )
  // Só quem escreve algum campo começa num modo de rascunho
  const writer = useMemo(
    () => canEditSomething(state.model, new Set(state.roles)),
    [state.model, state.roles]
  )
  const opening = openingMode({
    roles: state.roles,
    status,
    active,
    writer,
    npc: state.character.kind === 'npc',
  })
  const [store] = useState(() => {
    // Com pedido de rascunho (ficha recém-criada), o modo de montagem; sem
    // pedido, o modo de abertura da ficha (T-05)
    const draftMode: SheetMode = active ? 'create' : 'evolve'
    const mode: SheetMode =
      initialMode && isDraftMode(initialMode)
        ? writer
          ? draftMode
          : defaultMode(state.roles)
        : (initialMode ?? opening)
    const created = createSheetStore({
      characterId: id,
      model: state.model,
      sheet: state.sheet,
      sheetVersion,
      roles: state.roles,
      mode: forced ?? mode,
      sync,
      creation,
      editable: forced === null,
    })
    if (!forced && isDraftMode(mode)) created.getState().startDraft()
    return created
  })
  useEffect(() => sync.register(id, store), [sync, id, store])
  // A política (travada, arquivada, de quem saiu): sem edição, o rascunho
  // que volta do servidor fica guardado no aparelho em vez de abrir Editar
  useEffect(() => {
    store.getState().setEditable(forced === null)
  }, [store, forced])
  // O cabeçalho acompanha o rascunho; ao sair da ficha, volta a zero. Só
  // avisa quando o que ele mostra muda
  useEffect(() => {
    if (!onDraftState) return
    const storyteller = store.getState().roles.includes('storyteller')
    let last = draftStateOf(store.getState(), storyteller)
    onDraftState(last)
    const unsubscribe = store.subscribe(s => {
      const next = draftStateOf(s, storyteller)
      if (jsonEqual(next, last)) return
      last = next
      onDraftState(next)
    })
    return () => {
      unsubscribe()
      onDraftState(NO_DRAFT)
    }
  }, [store, onDraftState])
  // O rascunho guardado no aparelho, e a oferta de recuperá-lo (T-03)
  const persistence = useDraftPersistence({
    store,
    drafts: sync.drafts,
    characterId: id,
    templateVersion: state.model.version,
    idleMode: forced ?? defaultMode(state.roles),
    onLost: () =>
      toast.show({
        message:
          'O rascunho ficou grande demais para guardar neste aparelho e não poderá ser recuperado. Salve para não perder.',
      }),
  })
  useEffect(() => {
    const s = store.getState()
    if (!jsonEqual(s.creation, creation)) s.setCreation(creation)
  }, [store, creation])
  // O estado mudou (o narrador travou, arquivou, reativou; a criação foi
  // concluída ou devolvida): o modo acompanha. Sem modo forçado, a ficha vai
  // ao modo de abertura: a montagem, se ainda em criação (T-05); o Jogo, para
  // a dona da ficha em uso
  // O modo de abertura da renderização anterior: a ficha aberta no Editar da
  // criação livre (inclusive pelo cache persistido, antes da resposta do
  // servidor) segue o modo de abertura novo quando a criação acaba
  const openedAs = useRef(opening)
  useEffect(() => {
    const s = store.getState()
    const before = openedAs.current
    openedAs.current = opening
    let next = forced ?? (s.mode === 'read' ? opening : null)
    // A criação por pontos acabou (ou virou livre): o modo dela não vale mais
    if (!next && s.mode === 'create' && !active) next = opening
    // A criação livre acabou com a ficha no Editar da abertura e nada a
    // salvar: o modo de abertura novo (o Jogo, para a dona). Com alterações,
    // o Editar fica: o servidor decide o lote
    if (
      !next &&
      s.mode === 'evolve' &&
      before === 'evolve' &&
      opening !== 'evolve' &&
      !s.draft?.size
    )
      next = opening
    // Voltou à criação por pontos com Evoluir aberto: o rascunho continua
    if (!next && s.mode === 'evolve' && active) next = 'create'
    if (!next || next === s.mode) return
    // Entre modos de rascunho, o rascunho continua (liberar a criação livre
    // leva da Criação ao Editar sem perder o que não foi salvo)
    if (isDraftMode(s.mode) && !isDraftMode(next)) s.discardDraft()
    else if (!isDraftMode(s.mode) && isDraftMode(next)) s.startDraft()
    s.setMode(next)
  }, [store, forced, opening, active])
  // Rebuscada (foco, conflito): o store confere a versão e valida
  useEffect(() => {
    store.getState().received(sheet, sheetVersion)
  }, [store, sheet, sheetVersion])
  const creationValue = useMemo(
    () => ({
      characterId: id,
      chronicleId: state.character.chronicle.id,
      status,
      info,
      active,
    }),
    [id, state.character.chronicle.id, status, info, active]
  )
  return (
    <>
      <LifecycleContext.Provider value={lifecycle}>
        <CreationContext.Provider value={creationValue}>
          {/* O painel do NPC e a barra do narrador: fixos acima da ficha
              fora do celular; no celular, rolam com ela (T-27) */}
          <SheetView
            store={store}
            editable
            header={
              <>
                <NpcVisibilityBar state={state} />
                <StorytellerBar ownerName={state.character.owner.username} />
              </>
            }
          />
          <LeaveGuard store={store} />
          <DraftRecovery
            persistence={persistence}
            store={store}
            blocked={forced !== null}
          />
        </CreationContext.Provider>
      </LifecycleContext.Provider>
    </>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
  viewer: { flex: 1 },
  readNotice: {
    gap: tokens.space[1],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[3],
  },
  identity: {
    alignItems: 'center',
    gap: tokens.space[3],
    padding: tokens.space[8],
  },
})

function IdentityProjection({
  character,
}: {
  readonly character: Extract<
    import('./data').CharacterData,
    { projection: 'identity' }
  >
}) {
  return (
    <View style={styles.identity} accessibilityRole="summary">
      <Avatar
        name={character.identity.name}
        imageUrl={character.identity.portraitUrl}
        size="lg"
      />
      <Text variant="displaySm">{character.identity.name}</Text>
      {character.identity.subtitle ? (
        <Text>{character.identity.subtitle}</Text>
      ) : null}
      {character.identity.chip ? (
        <Text color="inkMuted">{character.identity.chip}</Text>
      ) : null}
      <Text color="inkMuted">O narrador revelou apenas a identidade.</Text>
    </View>
  )
}

function NpcVisibilityBar({
  state,
}: {
  readonly state: Extract<SheetState, { status: 'ready' }>
}) {
  const character = state.character
  const change = useSetNpcVisibility(character.chronicle.id, character.id)
  const presentation = useSetNpcPresentation(
    character.chronicle.id,
    character.id
  )
  const [portraitUrl, setPortraitUrl] = useState(
    character.identity.portraitUrl ?? ''
  )
  const visibilityCommand = useRef<{
    visibility: 'hidden' | 'identity' | 'full'
    key: string
  } | null>(null)
  const presentationKey = useRef<string | null>(null)
  const toast = useToast()
  // T-46: revelar mais abre a confirmação; o rádio só muda com a resposta
  const [reveal, setReveal] = useState<{
    readonly target: Reveal
    readonly open: boolean
  } | null>(null)
  // O aviso do sucesso espera a folha sair da tela (onClosed)
  const revealed = useRef<string | null>(null)
  useEffect(() => {
    setPortraitUrl(character.identity.portraitUrl ?? '')
  }, [character.identity.portraitUrl])
  if (character.kind !== 'npc' || !state.roles.includes('storyteller'))
    return null
  const send = (visibility: NpcVisibility, done: () => void) => {
    const pending =
      visibilityCommand.current?.visibility === visibility
        ? visibilityCommand.current
        : { visibility, key: randomUUID() }
    visibilityCommand.current = pending
    change.mutate(
      {
        visibility,
        revision: character.visibilityRevision,
        clientCommandId: pending.key,
      },
      {
        onSuccess: () => {
          visibilityCommand.current = null
          done()
        },
        onError: error => {
          if (statusOf(error)) visibilityCommand.current = null
        },
      }
    )
  }
  const choices = [
    { id: 'hidden' as const, label: 'Oculto' },
    {
      id: 'identity' as const,
      label: 'Identidade',
      meta: 'Publica nome, selo, subtítulo e retrato.',
    },
    {
      id: 'full' as const,
      label: 'Ficha',
      meta: 'Abre uma cópia somente leitura, sem notas do narrador.',
    },
  ]
  return (
    <View style={styles.readNotice}>
      {/* Um radiogroup de verdade: o estado atual é "marcado", não um botão
          desabilitado (que parecia esmaecido). Ativação manual no teclado:
          a seta não revela o NPC; só Espaço, Enter ou toque. */}
      <Choice
        label="Visibilidade do NPC"
        value={character.visibility}
        options={choices}
        disabled={change.isPending}
        testID="npc-visibility"
        onChange={id => {
          const choice = choices.find(c => c.id === id)
          if (!choice || character.visibility === choice.id) return
          if (revealsMore(npcVisibilityOf(character.visibility), choice.id)) {
            // O erro de uma tentativa anterior não abre a folha nova
            change.reset()
            setReveal({ target: choice.id, open: true })
            return
          }
          send(choice.id, () =>
            toast.show({ message: lowerDone(choice.id, character.name) })
          )
        }}
      />
      {change.isError && !reveal?.open ? (
        <Text color="danger">{messageOf(change.error)}</Text>
      ) : null}
      {reveal ? (
        <RevealNpcSheet
          visible={reveal.open}
          target={reveal.target}
          name={character.name}
          busy={change.isPending}
          error={change.isError ? messageOf(change.error) : null}
          onConfirm={() =>
            send(reveal.target, () => {
              revealed.current = REVEAL_COPY[reveal.target].done
              setReveal({ target: reveal.target, open: false })
            })
          }
          // Com o envio em curso, fechar não desfaria a revelação: espera
          onClose={() => {
            if (!change.isPending)
              setReveal({ target: reveal.target, open: false })
          }}
          onClosed={() => {
            setReveal(null)
            const message = revealed.current
            revealed.current = null
            if (message) toast.show({ message })
          }}
        />
      ) : null}
      <TextField
        label="Retrato HTTPS"
        value={portraitUrl}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={2048}
        hint="O retrato é incluído quando a identidade do NPC é revelada."
        onChangeText={value => {
          presentationKey.current = null
          setPortraitUrl(value)
        }}
      />
      <Button
        title={presentationKey.current ? 'Reenviar retrato' : 'Salvar retrato'}
        variant="secondary"
        busy={presentation.isPending}
        onPress={() =>
          presentation.mutate(
            {
              clientCommandId: (presentationKey.current ??= randomUUID()),
              revision: character.presentationRevision,
              portraitUrl: portraitUrl.trim() || null,
            },
            {
              onSuccess: () => {
                presentationKey.current = null
              },
              onError: error => {
                if (statusOf(error)) presentationKey.current = null
              },
            }
          )
        }
      />
      {presentation.isError ? (
        <Text color="danger">{messageOf(presentation.error)}</Text>
      ) : null}
    </View>
  )
}
