import { resolve } from '@tms/sheet-core'
import { example, modelOf } from '../../../test/fixtures'
import { filterActive, passesRule, visibleFields } from '../filters'
import { byLabel, fold, nextItemId, noneOf } from '../text'

describe('texto de apoio', () => {
  it.each([
    ['Ocultismo', 'ocultismo'],
    ['  Condução ', 'conducao'],
    ['AÇÃO', 'acao'],
    ['Ñandú', 'nandu'],
  ])('fold(%s) = %s', (input, out) => {
    expect(fold(input)).toBe(out)
  })

  it.each([
    ['Disciplina', 'Nenhuma Disciplina'],
    ['Antecedente', 'Nenhum Antecedente'],
    ['Magia', 'Nenhuma Magia'],
    ['Dom', 'Nenhum Dom'],
    ['Façanha', 'Nenhuma Façanha'],
    ['Arma de fogo', 'Nenhuma Arma de fogo'],
    ['Problema', 'Nenhum Problema'],
    ['Item', 'Nenhum Item'],
  ])('noneOf(%s)', (label, out) => {
    expect(noneOf(label)).toBe(out)
  })

  // T-60: a ordem do rótulo em português, igual no Hermes, no web e no Jest
  it('byLabel: acento, "ç" e caixa não contam; o empate fica estável', () => {
    expect(
      byLabel(['ética', 'Zelo', 'açúcar', 'Ação', 'acaso', 'Bala'])
    ).toEqual(['Ação', 'acaso', 'açúcar', 'Bala', 'ética', 'Zelo'])
    // empate no fold: desempata pelo rótulo original, sempre igual
    expect(byLabel(['área', 'Area', 'area'])).toEqual(['Area', 'area', 'área'])
    expect(byLabel(['b', 'a'])).toEqual(['a', 'b'])
    // com chave: o nome de um item que não é texto
    expect(
      byLabel([{ name: 'Rapidez' }, { name: 'Ofuscação' }], x => x.name)
    ).toEqual([{ name: 'Ofuscação' }, { name: 'Rapidez' }])
    // devolve cópia
    const input = ['b', 'a']
    byLabel(input)
    expect(input).toEqual(['b', 'a'])
  })

  it('byLabel nos templates do V20: Arquétipos e Disciplinas', () => {
    const v20 = modelOf('vtm-v20')
    const def = (id: string) =>
      v20.fields.get(id)?.def as unknown as {
        suggestions?: string[]
        catalog?: string[]
      }
    const archetypes = byLabel(def('nature').suggestions ?? [])
    expect(archetypes).toHaveLength(42)
    expect(archetypes.slice(0, 5)).toEqual([
      'Arquiteto',
      'Autocrata',
      'Bon Vivant',
      'Caçador de Emoções',
      'Camaleão',
    ])
    expect(archetypes.slice(-3)).toEqual([
      'Trapaceiro',
      'Valentão',
      'Visionário',
    ])
    const disciplines = byLabel(def('disciplines').catalog ?? [])
    expect(disciplines).toEqual([
      'Animalismo',
      'Auspícios',
      'Demência',
      'Dominação',
      'Fortitude',
      'Metamorfose',
      'Necromancia',
      'Ofuscação',
      'Potência',
      'Presença',
      'Quietus',
      'Quimerismo',
      'Rapidez',
      'Serpentis',
      'Taumaturgia',
      'Tenebrosidade',
      'Vicissitude',
    ])
  })

  it('nextItemId não repete id', () => {
    expect(nextItemId([])).toBe('i1')
    expect(nextItemId([{ id: 'd1' }, { id: 'd2' }])).toBe('i3')
    expect(nextItemId([{ id: 'i2' }, { id: 'i3' }])).toBe('i4')
  })
})

describe('regras de filtro (contrato: filterRules)', () => {
  const vtm = modelOf('vtm-v20')
  const helena = resolve(vtm, example('helena').sheet)
  const coc = example('joana')
  const cocModel = modelOf(coc.system)
  const joana = resolve(cocModel, coc.sheet)
  const dnd = example('lia')
  const dndModel = modelOf(dnd.system)
  const lia = resolve(dndModel, dnd.sheet)

  it('invested: rating e number acima de 0; outros tipos passam', () => {
    const occult = helena.get('occult')
    const drive = helena.fields.find(r => r.type === 'rating' && r.base === 0)
    if (!occult || !drive) throw new Error('fixture')
    expect(passesRule('invested', occult)).toBe(true)
    expect(passesRule('invested', drive)).toBe(false)
    const name = helena.get('name')
    if (!name) throw new Error('fixture')
    expect(passesRule('invested', name)).toBe(true)
  })

  it('proficient (D&D) e aboveBase (CoC)', () => {
    const marks = lia.fields.filter(r => r.type === 'mark')
    expect(marks.some(r => passesRule('proficient', r))).toBe(true)
    expect(marks.some(r => !passesRule('proficient', r))).toBe(true)
    const percents = joana.fields.filter(r => r.type === 'percent')
    expect(percents.some(r => passesRule('aboveBase', r))).toBe(true)
    expect(percents.some(r => !passesRule('aboveBase', r))).toBe(true)
    // Regra desconhecida (template mais novo) não esconde nada
    expect(percents.every(r => passesRule('naoExiste', r))).toBe(true)
  })

  it('o filtro some em Editar', () => {
    const abilities = vtm.zones
      .flatMap(z => z.sections)
      .find(s => s.id === 'abilities')
    if (!abilities) throw new Error('fixture')
    expect(filterActive(abilities, 'read', true)).toBe(true)
    expect(filterActive(abilities, 'play', true)).toBe(true)
    expect(filterActive(abilities, 'evolve', true)).toBe(false)
    expect(filterActive(abilities, 'read', false)).toBe(false)
    expect(
      visibleFields(abilities, helena, { filtered: false, search: '' })
    ).toHaveLength(30)
    expect(
      visibleFields(abilities, helena, { filtered: false, search: 'ÓCULT' })
    ).toEqual(['occult'])
  })
})
