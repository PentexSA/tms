import { AppBar, Button, EmptyState, Screen, Skeleton } from '@tms/ui'
import { useRouter } from 'expo-router'

import { messageOf, statusOf } from '../lib/errors'
import { useSheetData } from './data'
import { SheetView } from './SheetView'

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
      body = (
        <SheetView
          model={state.model}
          sheet={state.sheet}
          roles={state.roles}
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
