import { npcVisibilityText } from '../characterState'
import { buildItem, bySection, type TableRowData } from '../tableItems'

// T-52: a visibilidade do NPC como texto (regra pura) e a Mesa em seções.
// (.tsx: o testMatch do Jest em components/ só pega .test.tsx)

const row = (over: Partial<TableRowData>): TableRowData => ({
  id: 'x',
  name: 'Ficha',
  owner: { id: 'u1', username: 'ana' },
  systemCode: 'vtm-v20',
  templateVersion: '1.0.0',
  sheetVersion: 1,
  updatedAt: '2026-11-01T12:00:00Z',
  sheet: {},
  ...over,
})

describe('npcVisibilityText', () => {
  it.each([
    ['hidden', 'Oculto'],
    ['identity', 'Identidade revelada'],
    ['full', 'Ficha revelada'],
    [undefined, null],
    [null, null],
    ['outra', null],
  ])('%p → %p', (visibility, expected) => {
    expect(npcVisibilityText(visibility)).toBe(expected)
  })
})

describe('Mesa: visibilidade e seções', () => {
  it('só o NPC tem visibilidade no item', () => {
    expect(
      buildItem(row({ kind: 'npc', visibility: 'hidden' }), undefined)
        .visibility
    ).toBe('Oculto')
    // O PC nunca mostra visibilidade, mesmo que a API mande uma
    expect(
      buildItem(row({ kind: 'pc', visibility: 'hidden' }), undefined).visibility
    ).toBeNull()
    expect(buildItem(row({}), undefined).visibility).toBeNull()
  })

  it('separa PCs e NPCs, cada um na ordem recebida', () => {
    const items = [
      row({ id: 'n1', kind: 'npc' }),
      row({ id: 'p1', kind: 'pc' }),
      row({ id: 'n2', kind: 'npc' }),
      row({ id: 'p2' }),
    ].map(r => buildItem(r, undefined))
    const { pcs, npcs } = bySection(items)
    expect(pcs.map(i => i.row.id)).toEqual(['p1', 'p2'])
    expect(npcs.map(i => i.row.id)).toEqual(['n1', 'n2'])
  })
})
