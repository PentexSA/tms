import type { RoleName, SheetMode } from '@tms/sheet-core'
import { AppBar, Button, EmptyState, Screen, Skeleton } from '@tms/ui'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'

import { messageOf, statusOf } from '../lib/errors'
import { type SheetState, useSheetData } from './data'
import { SheetView } from './SheetView'
import { createSheetStore } from './store/sheetStore'
import { useSync } from './sync/SyncProvider'

export function SheetScreen({ id }: { readonly id: string }) {
  const router = useRouter()
  const state = useSheetData(id)
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
        />
      )
  }

  return (
    <Screen>
      <AppBar title={title} back={back} />
      {body}
    </Screen>
  )
}

/**
 * O dono abre a própria ficha em Jogo; os demais (narrador, outros jogadores),
 * em Leitura. É UX: quem decide se a escrita vale é o servidor.
 */
export const defaultMode = (roles: readonly RoleName[]): SheetMode =>
  roles.includes('owner') ? 'play' : 'read'

/** A ficha viva: store por ficha, ligado à fila e à ficha do cache. */
function LiveSheet({
  state,
}: {
  readonly state: Extract<SheetState, { status: 'ready' }>
}) {
  const sync = useSync()
  const { id, sheet, sheetVersion } = state.character
  const [store] = useState(() =>
    createSheetStore({
      characterId: id,
      model: state.model,
      sheet: state.sheet,
      sheetVersion,
      roles: state.roles,
      mode: defaultMode(state.roles),
      sync,
    })
  )
  useEffect(() => sync.register(id, store), [sync, id, store])
  // Rebuscada (foco, conflito): o store confere a versão e valida
  useEffect(() => {
    store.getState().received(sheet, sheetVersion)
  }, [store, sheet, sheetVersion])
  return <SheetView store={store} />
}
