import { act, fireEvent, screen } from '@testing-library/react-native'
import { Stack, useRouter } from 'expo-router'
import { renderRouter } from 'expo-router/testing-library'
import { Pressable, Text } from 'react-native'
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'

import { useBackTo } from '../../lib/navigation'

// P12, achado 6 da onda 3 (três "voltar" para sair da crônica no AVD). O
// roteador de verdade, com telas mínimas: a lista abre a crônica por push,
// e o "‹" da crônica usava replace('/'), que no nativo punha uma segunda
// lista em cima da primeira ([lista, lista]). O voltar do Android caía na
// lista de baixo, igual à de cima: um toque a mais. Com useBackTo, a
// pilha volta a ter uma lista só.
jest.unmock('expo-router')

// O resetMocks apaga a implementação do mock da safe area, e a pilha nativa
// lê as margens: de volta, a cada teste
beforeEach(() => {
  jest
    .mocked(useSafeAreaInsets)
    .mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 })
  jest
    .mocked(useSafeAreaFrame)
    .mockReturnValue({ x: 0, y: 0, width: 393, height: 852 })
})

function List() {
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/chronicles/c1')}
    >
      <Text>Abrir crônica</Text>
    </Pressable>
  )
}

function Chronicle({ replaceToList }: { readonly replaceToList: boolean }) {
  const router = useRouter()
  const back = useBackTo('/')
  return (
    <Pressable
      accessibilityRole="button"
      onPress={replaceToList ? () => router.replace('/') : back}
    >
      <Text>Crônicas</Text>
    </Pressable>
  )
}

const routes = (replaceToList: boolean) => ({
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: () => <List />,
  'chronicles/[id]': () => <Chronicle replaceToList={replaceToList} />,
})

interface StackState {
  readonly routes: readonly {
    readonly name: string
    readonly state?: StackState
  }[]
}

type Router = Awaited<ReturnType<typeof renderRouter>>

/** Quantas telas a pilha do app tem agora (dentro da raiz `__root`). */
const depth = (view: Router) => {
  const root = view.getRouterState() as StackState | undefined
  return root?.routes[0]?.state?.routes.length ?? 0
}

describe('o "‹" da crônica e a pilha (achado 6)', () => {
  it('com useBackTo, voltar deixa uma lista só', async () => {
    const view = await renderRouter(routes(false), { initialUrl: '/' })
    fireEvent.press(
      await screen.findByRole('button', { name: 'Abrir crônica' })
    )
    expect(screen).toHavePathname('/chronicles/c1')
    expect(depth(view)).toBe(2)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Crônicas' }))
    })
    expect(screen).toHavePathname('/')
    expect(depth(view)).toBe(1)
  })

  it('o replace de antes empilhava outra lista (o defeito)', async () => {
    const view = await renderRouter(routes(true), { initialUrl: '/' })
    fireEvent.press(
      await screen.findByRole('button', { name: 'Abrir crônica' })
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Crônicas' }))
    })
    expect(screen).toHavePathname('/')
    expect(depth(view)).toBe(2)
  })
})
