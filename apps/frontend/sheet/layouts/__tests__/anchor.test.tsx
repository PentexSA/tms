import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { View } from 'react-native'
import { useAnchor } from '../anchor'
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
