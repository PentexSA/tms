import { modelOf } from '../../../test/fixtures'
import {
  arrange,
  buildItem,
  stageCounts,
  stageOf,
  type TableItem,
  type TableRowData,
  tableCreationInput,
} from '../tableItems'

// P09-D (D-10, R-15): a etapa da criação de cada cartão da Mesa, para o
// filtro "Em criação" e "Pendentes", e a entrada da conta do cartão

let seq = 0
const rowOf = (extra: Partial<TableRowData> = {}): TableRowData => ({
  id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
  name: `Ficha ${seq}`,
  owner: { id: 'u1', username: 'dona' },
  systemCode: 'vtm-v20',
  templateVersion: '1.0.0',
  sheetVersion: 1,
  updatedAt: '2026-11-05T12:00:00Z',
  sheet: { values: { name: `Ficha ${seq}` }, specialties: {} },
  kind: 'pc',
  ...extra,
})

const vtm = modelOf('vtm-v20')
const item = (extra: Partial<TableRowData> = {}): TableItem =>
  buildItem(rowOf(extra), vtm)

describe('stageOf', () => {
  it('em criação: a vez do jogador; pendentes: a vez do narrador', () => {
    const cases: [Partial<TableRowData>, 'creating' | 'pending' | null][] = [
      [{ status: 'creating', creationMode: 'points' }, 'creating'],
      [{ status: 'creating', creationMode: 'free' }, 'creating'],
      [{ status: 'creating', returned: true }, 'creating'],
      [{ status: 'creating', adjust: true }, 'creating'],
      [{ status: 'creating', creationMode: 'free', ready: true }, 'pending'],
      [{ status: 'pending', creationMode: 'points' }, 'pending'],
      [{ status: 'active', activatedAt: '2026-11-01T12:00:00Z' }, null],
      [{ status: 'active', lockedAt: '2026-11-02T12:00:00Z' }, null],
      [{ status: 'archived' }, null],
      [{ status: 'dead' }, null],
    ]
    for (const [extra, stage] of cases) expect(stageOf(item(extra))).toBe(stage)
  })

  it('o NPC fica fora dos dois, oculto ou não, em qualquer estado', () => {
    for (const visibility of ['hidden', 'identity', 'full'])
      for (const status of ['creating', 'pending'])
        expect(stageOf(item({ kind: 'npc', visibility, status }))).toBeNull()
  })

  it('a contagem e o filtro, combinados com "Só com alerta"', () => {
    const items = [
      item({ status: 'creating' }),
      item({ status: 'creating', adjust: true }),
      item({ status: 'pending' }),
      item({ status: 'creating', ready: true }),
      item({ status: 'active' }),
      item({ kind: 'npc', visibility: 'hidden', status: 'creating' }),
    ]
    expect(stageCounts(items)).toEqual({ creating: 2, pending: 2 })
    const creating = arrange(items, {
      sort: 'name',
      onlyAlerts: false,
      stage: 'creating',
    })
    expect(creating.map(i => i.row.name)).toEqual([
      items[0]?.row.name,
      items[1]?.row.name,
    ])
    expect(
      arrange(items, { sort: 'name', onlyAlerts: false, stage: 'pending' })
    ).toHaveLength(2)
    // Ninguém com alerta: o filtro de alerta combina e esvazia
    expect(
      arrange(items, { sort: 'name', onlyAlerts: true, stage: 'creating' })
    ).toEqual([])
    // Sem etapa: todos
    expect(arrange(items, { sort: 'name', onlyAlerts: false })).toHaveLength(
      items.length
    )
  })
})

describe('tableCreationInput', () => {
  it('a entrada do PC por pontos, com o parse do core de novo', () => {
    const input = tableCreationInput(
      rowOf({
        creationInput: {
          choices: {
            priorities: { attributes: ['social', 'physical', 'mental'] },
          },
          config: { freebies: 10 },
        },
      }),
      vtm
    )
    expect(input?.config).toMatchObject({ mode: 'points', freebies: 10 })
    expect(input?.choices).toEqual({
      priorities: { attributes: ['social', 'physical', 'mental'] },
    })
  })

  it('o que não tem a forma vale como ausente', () => {
    const input = tableCreationInput(
      rowOf({
        creationInput: {
          choices: { priorities: { attributes: ['x'] } },
          config: { freebies: -1 },
        },
      }),
      vtm
    )
    expect(input?.choices).toBeUndefined()
    expect(input?.config.mode).toBe('points')
  })

  it('NPC, sem o campo, criação livre ou lixo: null', () => {
    expect(
      tableCreationInput(
        rowOf({ kind: 'npc', creationInput: { choices: {}, config: {} } }),
        vtm
      )
    ).toBeNull()
    expect(tableCreationInput(rowOf(), vtm)).toBeNull()
    expect(tableCreationInput(rowOf({ creationInput: null }), vtm)).toBeNull()
    expect(
      tableCreationInput(
        rowOf({ creationInput: { config: { mode: 'free' } } }),
        vtm
      )
    ).toBeNull()
    expect(
      tableCreationInput(
        rowOf({
          creationInput: 'x' as unknown as TableRowData['creationInput'],
        }),
        vtm
      )
    ).toBeNull()
  })

  it('o item ganha o progresso só com a entrada', () => {
    expect(
      item({ status: 'creating', creationInput: { choices: {}, config: {} } })
        .progress?.parts[0]?.text
    ).toBe('Atributos (prioridade)')
    expect(item({ status: 'creating' }).progress).toBeNull()
    // Sem o template ainda: sem store, sem progresso
    expect(
      buildItem(
        rowOf({ creationInput: { choices: {}, config: {} } }),
        undefined
      ).progress
    ).toBeNull()
  })
})
