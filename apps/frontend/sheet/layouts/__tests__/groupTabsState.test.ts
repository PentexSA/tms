import {
  createGroupTabsStore,
  JUMP_TTL_MS,
  SCROLL_ROOT,
} from '../groupTabsState'

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

  // /code-review 2: o pedido não fica pendente para sempre
  it('o pedido expira, e a troca de aba à mão o esquece', async () => {
    const { store, jumps } = setup()
    const now = jest.spyOn(Date, 'now')
    now.mockReturnValue(10_000)
    store.jumpTo(['virtues'])
    now.mockReturnValue(10_000 + JUMP_TTL_MS + 1)
    store.anchorAt('virtues', 10)
    await frame()
    expect(jumps).toEqual([])
    now.mockRestore()
    store.jumpTo(['rites'])
    store.cancelJump()
    store.anchorAt('rites', 10)
    await frame()
    expect(jumps).toEqual([])
  })

  // /code-review 4: a faixa cresce com as sub-abas da seção de destino
  it('a faixa que cresce depois do salto corrige o destino, sem mover o foco', async () => {
    const { store, jumps } = setup()
    const focus = jest.fn()
    store.anchorAt('abilities', 900, focus)
    store.jumpTo(['abilities'])
    await frame()
    expect(jumps).toEqual([{ y: 1380, focus }])
    store.navHeight(170)
    expect(jumps.slice(1)).toEqual([{ y: 1330, focus: null }])
    // A mesma altura não rola de novo
    store.navHeight(170)
    expect(jumps).toHaveLength(2)
  })
})

// A3: no web, o onLayout não avisa quando uma vista só desce. Quando o
// conteúdo da rolagem muda de tamanho, as posições são lidas de novo
describe('remeasure (A3)', () => {
  const groups = [{ id: 'g', title: 'G', fieldIds: [] }]
  it('o painel que desceu ("Em jogo" aberto) troca a seção da faixa', () => {
    const store = createGroupTabsStore()
    store.register({ id: 'attributes', title: 'A', tabsId: 'a', groups })
    store.register({ id: 'abilities', title: 'H', tabsId: 'h', groups })
    store.panelAt(600)
    store.navHeight(120)
    store.sectionAt('attributes', 0)
    store.sectionAt('abilities', 900)
    // A rolagem deixa os Atributos no topo, com o painel em 600
    store.scrolled(500)
    expect(store.current()?.id).toBe('attributes')
    // O "Em jogo" abriu: o painel desceu 900, sem onLayout no web
    let panel = 600
    const off = store.onRemeasure(() => store.panelAt(panel))
    panel = 1500
    store.scrolled(1400)
    // Sem remedir, a faixa erra: acha que as Habilidades estão no topo
    expect(store.current()?.id).toBe('abilities')
    store.remeasure()
    expect(store.current()?.id).toBe('attributes')
    off()
    panel = 0
    store.remeasure()
    expect(store.panelTop()).toBe(1500 - 120)
  })
})
