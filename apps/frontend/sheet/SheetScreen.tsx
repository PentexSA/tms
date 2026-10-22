import { useQueryClient } from '@tanstack/react-query'
import type { RoleName, SheetMode } from '@tms/sheet-core'
import { AppBar, Button, EmptyState, Screen, Skeleton, tokens } from '@tms/ui'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf, statusOf } from '../lib/errors'
import { useRefetchOnFocus } from '../lib/queries/focus'
import { SheetProvider } from './context'
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

export function SheetScreen({
  id,
  initialMode,
}: {
  readonly id: string
  // A ficha recém-criada abre em Evoluir (Etapa 18)
  readonly initialMode?: SheetMode
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const state = useSheetData(id)
  const [history, setHistory] = useState(false)
  // Sem tempo real: voltar para a ficha rebusca (e o histórico, que é filho)
  useRefetchOnFocus(() =>
    queryClient.invalidateQueries(
      { queryKey: sheetKeys.character(id) },
      { cancelRefetch: false }
    )
  )
  const chronicle = state.status === 'ready' ? state.character.chronicle : null
  const back = chronicle
    ? {
        label: chronicle.name,
        onPress: () => router.replace(`/chronicles/${chronicle.id}`),
      }
    : { label: 'Crônicas', onPress: () => router.replace('/') }
  const title = state.status === 'ready' ? state.character.name : 'Ficha'

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
      {state.status === 'ready' ? (
        <HistorySheet
          characterId={id}
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
  const [store] = useState(() => {
    // Só quem escreve algum campo começa em Evoluir (ficha recém-criada); sem
    // pedido, o modo padrão do papel
    const writer = canEditSomething(state.model, new Set(state.roles))
    const mode: SheetMode =
      initialMode === 'evolve'
        ? writer
          ? 'evolve'
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
    })
    if (!forced && mode === 'evolve') created.getState().startDraft()
    return created
  })
  useEffect(() => sync.register(id, store), [sync, id, store])
  // O estado mudou (o narrador travou, arquivou, reativou): o modo acompanha.
  // Sem modo forçado, a ficha do dono volta ao Jogo
  useEffect(() => {
    const s = store.getState()
    const next = forced ?? (s.mode === 'read' ? defaultMode(state.roles) : null)
    if (!next || next === s.mode) return
    if (s.mode === 'evolve') s.discardDraft()
    s.setMode(next)
  }, [store, forced, state.roles])
  // Rebuscada (foco, conflito): o store confere a versão e valida
  useEffect(() => {
    store.getState().received(sheet, sheetVersion)
  }, [store, sheet, sheetVersion])
  return (
    <LifecycleContext.Provider value={lifecycle}>
      <SheetProvider store={store}>
        <StorytellerBar ownerName={state.character.owner.username} />
      </SheetProvider>
      <SheetView store={store} editable />
      <LeaveGuard store={store} />
    </LifecycleContext.Provider>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] },
})
