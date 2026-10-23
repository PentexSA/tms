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
  EmptyState,
  Screen,
  Skeleton,
  Text,
  TextField,
  tokens,
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
import { SheetProvider } from './context'
import { CreationContext } from './creation/CreationContext'
import {
  creationActive,
  creationInfoOf,
  creationInputOf,
} from './creation/creation'
import { type SheetState, sheetKeys, useSheetData } from './data'
import { canEditSomething } from './evolve/hooks'
import { LeaveGuard } from './evolve/LeaveGuard'
import { HistorySheet } from './history/HistorySheet'
import { blockedBy, LifecycleContext, type SheetLifecycle } from './policy'
import { SheetView } from './SheetView'
import { createSheetStore } from './store/sheetStore'
import { StatusMenuButton } from './storyteller/StatusMenu'
import { StorytellerBar } from './storyteller/StorytellerBar'
import { SwipeArea, TableNav } from './storyteller/TableNav'
import { OfflineBanner, SyncIndicator } from './sync/SyncIndicator'
import { useSync } from './sync/SyncProvider'
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
  const state = useSheetData(id)
  const [history, setHistory] = useState(false)
  const [xp, setXp] = useState(false)
  // Sem tempo real: voltar para a ficha rebusca (e o histórico, que é filho)
  useRefetchOnFocus(() =>
    queryClient.invalidateQueries(
      { queryKey: sheetKeys.character(id) },
      { cancelRefetch: false }
    )
  )
  useEffect(() => {
    if (state.status === 'error' && statusOf(state.error) === 404)
      queryClient.removeQueries({ queryKey: sheetKeys.character(id) })
  }, [id, queryClient, state])
  const chronicle =
    state.status === 'ready' || state.status === 'viewer'
      ? state.character.chronicle
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
      body = (
        <EmptyState
          title="Atualize o app"
          message="Esta ficha usa uma versão do sistema que este app ainda não conhece."
        />
      )
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
      body = (
        <View>
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
            <SyncIndicator />
            {state.status === 'ready' && state.roles.includes('storyteller') ? (
              <StatusMenuButton
                characterId={id}
                chronicleId={state.character.chronicle.id}
                model={state.model}
                status={state.character.status}
                locked={state.character.lockedAt !== null}
              />
            ) : null}
            {state.status === 'ready' && xpLedgerFields(state.model).length ? (
              <Button
                title="Experiência"
                variant="ghost"
                testID="xp-open"
                accessibilityHint="Abre o saldo, os pedidos e o extrato de XP"
                onPress={() => setXp(true)}
              />
            ) : null}
            {state.status === 'ready' ? (
              <Button
                title="Histórico"
                variant="ghost"
                accessibilityHint="Abre o histórico de alterações da ficha"
                onPress={() => setHistory(true)}
              />
            ) : null}
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

/**
 * O dono abre a própria ficha em Jogo; os demais (narrador, outros jogadores),
 * em Leitura. É UX: quem decide se a escrita vale é o servidor.
 */
export const defaultMode = (roles: readonly RoleName[]): SheetMode =>
  roles.includes('owner') ? 'play' : 'read'

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

/** A ficha viva: store por ficha, ligado à fila e à ficha do cache. */
function LiveSheet({
  state,
  initialMode,
}: {
  readonly state: Extract<SheetState, { status: 'ready' }>
  readonly initialMode?: SheetMode
}) {
  const sync = useSync()
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
  const [store] = useState(() => {
    // Só quem escreve algum campo começa em Evoluir (ficha recém-criada); sem
    // pedido, o modo padrão do papel
    const writer = canEditSomething(state.model, new Set(state.roles))
    const draftMode: SheetMode = active ? 'create' : 'evolve'
    const mode: SheetMode =
      initialMode && isDraftMode(initialMode)
        ? writer
          ? draftMode
          : defaultMode(state.roles)
        : (initialMode ?? defaultMode(state.roles))
    const created = createSheetStore({
      characterId: id,
      model: state.model,
      sheet: state.sheet,
      sheetVersion,
      roles: state.roles,
      mode: forced ?? mode,
      sync,
      creation,
    })
    if (!forced && isDraftMode(mode)) created.getState().startDraft()
    return created
  })
  useEffect(() => sync.register(id, store), [sync, id, store])
  useEffect(() => {
    const s = store.getState()
    if (!jsonEqual(s.creation, creation)) s.setCreation(creation)
  }, [store, creation])
  // O estado mudou (o narrador travou, arquivou, reativou; a criação foi
  // concluída ou devolvida): o modo acompanha. Sem modo forçado, a ficha do
  // dono volta ao Jogo
  useEffect(() => {
    const s = store.getState()
    let next = forced ?? (s.mode === 'read' ? defaultMode(state.roles) : null)
    // A criação acabou (ou virou livre): o modo dela não vale mais
    if (!next && s.mode === 'create' && !active) next = defaultMode(state.roles)
    // Voltou à criação por pontos com Evoluir aberto: o rascunho continua
    if (!next && s.mode === 'evolve' && active) {
      s.setMode('create')
      return
    }
    if (!next || next === s.mode) return
    if (isDraftMode(s.mode)) s.discardDraft()
    s.setMode(next)
  }, [store, forced, state.roles, active])
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
      <NpcVisibilityBar state={state} />
      <LifecycleContext.Provider value={lifecycle}>
        <CreationContext.Provider value={creationValue}>
          <SheetProvider store={store}>
            <StorytellerBar ownerName={state.character.owner.username} />
          </SheetProvider>
          <SheetView store={store} editable />
          <LeaveGuard store={store} />
        </CreationContext.Provider>
      </LifecycleContext.Provider>
    </>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
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
  useEffect(() => {
    setPortraitUrl(character.identity.portraitUrl ?? '')
  }, [character.identity.portraitUrl])
  if (character.kind !== 'npc' || !state.roles.includes('storyteller'))
    return null
  const choices = [
    { id: 'hidden' as const, label: 'Oculto' },
    { id: 'identity' as const, label: 'Identidade' },
    { id: 'full' as const, label: 'Ficha' },
  ]
  return (
    <View style={styles.readNotice} accessibilityRole="radiogroup">
      <Text variant="fieldLabel">Visibilidade do NPC</Text>
      <Text color="inkMuted">
        Identidade publica nome, selo, subtítulo e retrato. Ficha abre uma cópia
        somente leitura, sem notas do narrador.
      </Text>
      <View style={styles.actions}>
        {choices.map(choice => (
          <Button
            key={choice.id}
            title={choice.label}
            variant={
              character.visibility === choice.id ? 'primary' : 'secondary'
            }
            disabled={change.isPending || character.visibility === choice.id}
            onPress={() => {
              const pending =
                visibilityCommand.current?.visibility === choice.id
                  ? visibilityCommand.current
                  : { visibility: choice.id, key: randomUUID() }
              visibilityCommand.current = pending
              change.mutate(
                {
                  visibility: choice.id,
                  revision: character.visibilityRevision,
                  clientCommandId: pending.key,
                },
                {
                  onSuccess: () => {
                    visibilityCommand.current = null
                  },
                  onError: error => {
                    if (statusOf(error)) visibilityCommand.current = null
                  },
                }
              )
            }}
          />
        ))}
      </View>
      {change.isError ? (
        <Text color="danger">{messageOf(change.error)}</Text>
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
