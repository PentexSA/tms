import { createGroupTabsStore, SCROLL_ROOT } from '../groupTabsState'

// P05-D (R-18): as âncoras do "ir ao grupo". O pedido de ir a uma seção que
// ainda não foi medida (a aba acabou de trocar) espera o próximo `anchorAt`

const frame = () => new Promise(resolve => setTimeout(resolve, 20))

function setup() {
  const store = createGroupTabsStore()
  const jumps: { y: number; focus: (() => void) | null }[] = []
  store.onJump((y, focus) => jumps.push({ y, focus }))
  store.panelAt(600)
  store.navHeight(120)
  return { store, jumps }
}

describe('jumpTo', () => {
  it('resolve na hora quando a seção já foi medida', async () => {
    const { store, jumps } = setup()
    const focus = jest.fn()
    store.anchorAt('abilities', 900, focus)
    store.jumpTo(['abilities'])
    await frame()
    // O começo da seção fica logo abaixo da faixa fixa
    expect(jumps).toEqual([{ y: 600 + 900 - 120, focus }])
  })

  it('espera o anchorAt seguinte, e o pedido novo troca o velho', async () => {
    const { store, jumps } = setup()
    store.jumpTo(['virtues'])
    store.jumpTo(['advantages'])
    await frame()
    expect(jumps).toEqual([])
    store.anchorAt('virtues', 10)
    await frame()
    expect(jumps).toEqual([])
    store.anchorAt('advantages', 300)
    await frame()
    expect(jumps.map(j => j.y)).toEqual([780])
    // Resolvido, o pedido sai: medir de novo não rola de novo
    store.anchorAt('advantages', 310)
    await frame()
    expect(jumps).toHaveLength(1)
  })

  it('prefere o grupo, medido dentro da seção, à seção', async () => {
    const { store, jumps } = setup()
    const group = jest.fn()
    store.anchorAt('advantages', 300, jest.fn())
    store.anchorAt('advantages~layout', 40, null, 'advantages')
    store.anchorAt('advantages~body', 8, null, 'advantages~layout')
    store.anchorAt('advantages/virtues', 500, group, 'advantages~body')
    store.jumpTo(['advantages/virtues', 'advantages'])
    await frame()
    expect(jumps).toEqual([{ y: 600 + 300 + 40 + 8 + 500 - 120, focus: group }])
  })

  it('a âncora que saiu da tela não vale', async () => {
    const { store, jumps } = setup()
    store.anchorAt('attributes', 0)
    store.dropAnchor('attributes')
    store.jumpTo(['attributes'])
    await frame()
    expect(jumps).toEqual([])
  })

  it('o "Em jogo" é medido na rolagem, sem o painel nem a faixa', async () => {
    const { store, jumps } = setup()
    store.anchorAt('play', 240, null, SCROLL_ROOT)
    store.jumpTo(['play'])
    await frame()
    expect(jumps.map(j => j.y)).toEqual([240])
  })

  it('nunca rola para antes do começo', async () => {
    const { store, jumps } = setup()
    store.panelAt(50)
    store.anchorAt('attributes', 0)
    store.jumpTo(['attributes'])
    await frame()
    expect(jumps.map(j => j.y)).toEqual([0])
  })
})
