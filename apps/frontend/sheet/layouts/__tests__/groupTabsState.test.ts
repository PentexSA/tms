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
    // Resolvido, o pedido sai; uma medida nova do destino, dentro da
    // janela, só corrige a rolagem, sem mover o foco de novo (B1)
    store.anchorAt('advantages', 310)
    expect(jumps.slice(1)).toEqual([{ y: 790, focus: null }])
    // A mesma posição não rola de novo
    store.anchorAt('advantages', 310)
    expect(jumps).toHaveLength(2)
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

// B1 (roteiro do Android): a aba recém-montada mede a âncora numa posição
// provisória e depois na final; o salto vai para a final
describe('salto para outra aba (B1)', () => {
  it('a medida provisória da âncora não vence: o alvo é a final', async () => {
    const { store, jumps } = setup()
    const focus = jest.fn()
    store.jumpTo(['abilities'])
    // A primeira medida (o painel ainda sem as seções de cima) e a final, no
    // mesmo quadro: o salto espera um quadro quieto e vai direto à final
    store.anchorAt('abilities', 0, focus)
    store.anchorAt('abilities', 900, focus)
    await frame()
    expect(jumps).toEqual([{ y: 600 + 900 - 120, focus }])
    // A final num quadro depois do salto: a rolagem termina nela, e o foco
    // não se move de novo
    store.jumpTo(['rites'])
    store.anchorAt('rites', 0, focus)
    await frame()
    store.anchorAt('rites', 1500, focus)
    expect(jumps.at(-1)).toEqual({ y: 600 + 1500 - 120, focus: null })
    expect(jumps.filter(j => j.focus)).toHaveLength(2)
  })

  it('a medida final depois do salto corrige a rolagem, sem mover o foco', async () => {
    const { store, jumps } = setup()
    const focus = jest.fn()
    store.anchorAt('gifts', 0, focus)
    store.jumpTo(['gifts'])
    await frame()
    expect(jumps).toEqual([{ y: 480, focus }])
    store.anchorAt('gifts', 1200, focus)
    expect(jumps.slice(1)).toEqual([{ y: 600 + 1200 - 120, focus: null }])
    // Fora da janela do pedido, nada mais rola
    const now = jest.spyOn(Date, 'now')
    now.mockReturnValue(Date.now() + JUMP_TTL_MS + 10)
    store.anchorAt('gifts', 1300, focus)
    now.mockRestore()
    expect(jumps).toHaveLength(2)
  })
})
