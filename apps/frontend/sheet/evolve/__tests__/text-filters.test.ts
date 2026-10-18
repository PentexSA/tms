import { resolve } from '@tms/sheet-core'
import { example, modelOf } from '../../../test/fixtures'
import { filterActive, passesRule, visibleFields } from '../filters'
import { fold, nextItemId, noneOf } from '../text'

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

  it('o filtro some em Evoluir', () => {
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
