import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Platform, View } from 'react-native'
import { offsetTopOf, useAnchor } from '../anchor'
import {
  createGroupTabsStore,
  GroupTabsContext,
  type GroupTabsStore,
} from '../groupTabsState'

// P05-D (/code-review 6): a âncora que some da tela (o id vira nulo, como o
// "Onde foram os bônus" sem extrato) sai do mapa; um salto não vai para a
// posição velha

const frame = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20))
  })

function Probe({ id }: { readonly id: string | null }) {
  const { onLayout } = useAnchor(id)
  return <View testID="probe" onLayout={onLayout} />
}

function setup(store: GroupTabsStore, id: string | null) {
  return render(
    <GroupTabsContext.Provider value={{ strip: true, store }}>
      <Probe id={id} />
    </GroupTabsContext.Provider>
  )
}

it('o id nulo tira a âncora do mapa', async () => {
  const store = createGroupTabsStore()
  const jumps: number[] = []
  store.onJump(y => jumps.push(y))
  const view = setup(store, 'creation-ledger')
  fireEvent(screen.getByTestId('probe'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 400, width: 390, height: 100 } },
  })
  view.rerender(
    <GroupTabsContext.Provider value={{ strip: true, store }}>
      <Probe id={null} />
    </GroupTabsContext.Provider>
  )
  store.jumpTo(['creation-ledger'])
  await frame()
  expect(jumps).toEqual([])
})

// A3: a posição lida na hora, só no web (no app, o onLayout já avisa)
it('offsetTopOf lê o offsetTop só no web', () => {
  const view = { offsetTop: 240 } as never
  expect(offsetTopOf(view)).toBeNull()
  const os = Platform.OS
  Platform.OS = 'web'
  try {
    expect(offsetTopOf(view)).toBe(240)
    expect(offsetTopOf(null)).toBeNull()
    expect(offsetTopOf({} as never)).toBeNull()
  } finally {
    Platform.OS = os
  }
})
