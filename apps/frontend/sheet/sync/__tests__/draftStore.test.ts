import {
  createPersistedDraftStore,
  DRAFT_MAX_AGE_MS,
  type DraftRecord,
  parseDraftRecord,
} from '../draftStore'
import { createMemoryStorage, scopeStorage } from '../kv'

// T-03: o rascunho de Criação/Editar no storage do aparelho. Sobrevive a
// fechar o app; o que vem do disco é hostil; o logout apaga; nada de token.

const C1 = '00000000-0000-4000-8000-0000000000c1'
const C2 = '00000000-0000-4000-8000-0000000000c2'
const NOW = Date.UTC(2026, 10, 1, 15, 51)

const record = (extra: Partial<DraftRecord> = {}): DraftRecord => ({
  v: 1,
  characterId: C1,
  templateVersion: '1.0.0',
  baseVersion: 3,
  mode: 'create',
  savedAt: NOW - 1000,
  edits: [
    { path: 'values.strength', from: 1, to: 3 },
    { path: 'values.appearance', from: null, to: 2 },
    { path: 'specialties.strength', from: null, to: 'Pegada firme' },
  ],
  ...extra,
})

const setup = () => {
  const disk = createMemoryStorage()
  const drafts = createPersistedDraftStore(disk, () => NOW)
  return { disk, drafts }
}

describe('grava e lê', () => {
  it('o registro volta igual; sem alterações, apaga', async () => {
    const { drafts, disk } = setup()
    await drafts.write(record())
    expect(await drafts.read(C1)).toEqual(record())
    expect([...disk.data.keys()]).toEqual([`draft:${C1}`])
    await drafts.write(record({ edits: [] }))
    expect(await drafts.read(C1)).toBeNull()
    expect(disk.data.size).toBe(0)
  })

  it('o JSON gravado só tem as chaves da lista fechada (nenhum token)', async () => {
    const { drafts, disk } = setup()
    await drafts.write({
      ...record(),
      accessToken: 'segredo',
      edits: [{ path: 'values.strength', from: 1, to: 3, token: 'x' }],
    } as unknown as DraftRecord)
    const text = disk.data.get(`draft:${C1}`) ?? ''
    const raw = JSON.parse(text) as Record<string, unknown>
    expect(Object.keys(raw).sort()).toEqual([
      'baseVersion',
      'characterId',
      'edits',
      'mode',
      'savedAt',
      'templateVersion',
      'v',
    ])
    expect(Object.keys((raw.edits as object[])[0] ?? {}).sort()).toEqual([
      'from',
      'path',
      'to',
    ])
    expect(text).not.toContain('segredo')
  })

  it('a contagem acompanha gravar, apagar e limpar', async () => {
    const { drafts } = setup()
    const listener = jest.fn()
    drafts.count.subscribe(listener)
    await drafts.write(record())
    await drafts.write(record({ characterId: C2 }))
    expect(drafts.count.getSnapshot()).toBe(2)
    await drafts.remove(C2)
    expect(drafts.count.getSnapshot()).toBe(1)
    await drafts.clear()
    expect(drafts.count.getSnapshot()).toBe(0)
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('characters lista as fichas com rascunho válido e reconta do disco', async () => {
    const { disk } = setup()
    const before = createPersistedDraftStore(disk, () => NOW)
    await before.write(record())
    await before.write(record({ characterId: C2 }))
    // Outra abertura do app: a contagem começa do disco
    const after = createPersistedDraftStore(disk, () => NOW)
    expect(after.count.getSnapshot()).toBe(0)
    expect((await after.characters()).sort()).toEqual([C1, C2])
    expect(after.count.getSnapshot()).toBe(2)
  })
})

describe('o que vem do disco é hostil: descartado e apagado', () => {
  const stored = async (raw: string) => {
    const { drafts, disk } = setup()
    disk.data.set(`draft:${C1}`, raw)
    const read = await drafts.read(C1)
    return { read, left: disk.data.size }
  }

  it.each([
    ['JSON quebrado', '{"v":1,'],
    ['versão do registro', JSON.stringify(record({ v: 2 as 1 }))],
    ['id que não é UUID', JSON.stringify(record({ characterId: 'x' }))],
    ['id de outra ficha na chave', JSON.stringify(record({ characterId: C2 }))],
    [
      'versão de template estranha',
      JSON.stringify(record({ templateVersion: '1;drop' })),
    ],
    ['baseVersion negativa', JSON.stringify(record({ baseVersion: -1 }))],
    ['baseVersion fracionada', JSON.stringify(record({ baseVersion: 1.5 }))],
    ['modo desconhecido', JSON.stringify(record({ mode: 'play' as 'create' }))],
    [
      'caminho inválido',
      JSON.stringify(
        record({ edits: [{ path: 'values.__proto__.x', from: 1, to: 2 }] })
      ),
    ],
    [
      'caminho repetido',
      JSON.stringify(
        record({
          edits: [
            { path: 'values.strength', from: 1, to: 2 },
            { path: 'values.strength', from: 2, to: 3 },
          ],
        })
      ),
    ],
    [
      'mais de 50 alterações',
      JSON.stringify(
        record({
          edits: Array.from({ length: 51 }, (_, i) => ({
            path: `values.f${i}`,
            from: 0,
            to: 1,
          })),
        })
      ),
    ],
    [
      'mais de 64 KiB',
      JSON.stringify(
        record({
          edits: [{ path: 'values.notes', from: null, to: 'x'.repeat(70_000) }],
        })
      ),
    ],
    ['gravado no futuro', JSON.stringify(record({ savedAt: NOW + 60_000 }))],
    [
      'vencido (mais de 7 dias)',
      JSON.stringify(record({ savedAt: NOW - DRAFT_MAX_AGE_MS - 1 })),
    ],
    [
      'alteração sem "to"',
      JSON.stringify(
        record({ edits: [{ path: 'values.strength', from: 1 }] as never })
      ),
    ],
  ])('%s', async (_, raw) => {
    const { read, left } = await stored(raw)
    expect(read).toBeNull()
    expect(left).toBe(0)
  })

  it('o parse aceita o limite exato: 7 dias e 50 alterações', () => {
    expect(
      parseDraftRecord(record({ savedAt: NOW - DRAFT_MAX_AGE_MS }), NOW)
    ).not.toBeNull()
    expect(
      parseDraftRecord(
        record({
          edits: Array.from({ length: 50 }, (_, i) => ({
            path: `values.f${i}`,
            from: 0,
            to: 1,
          })),
        }),
        NOW
      )
    ).not.toBeNull()
  })

  it('o registro inválido nem é gravado; o anterior fica', async () => {
    const { drafts } = setup()
    await drafts.write(record())
    await drafts.write(record({ savedAt: NOW + 1 }))
    expect(await drafts.read(C1)).toEqual(record())
  })

  it('sweep apaga o que venceu e o que está quebrado', async () => {
    const { drafts, disk } = setup()
    await drafts.write(record())
    await drafts.write(record({ characterId: C2 }))
    disk.data.set('draft:nao-uuid', '{}')
    await drafts.sweep(NOW + DRAFT_MAX_AGE_MS)
    expect(disk.data.size).toBe(0)
  })
})

describe('escopo por usuário e logout', () => {
  it('o usuário B não lê o rascunho de A no mesmo aparelho', async () => {
    const disk = createMemoryStorage()
    const a = createPersistedDraftStore(scopeStorage(disk, 'user-a'), () => NOW)
    const b = createPersistedDraftStore(scopeStorage(disk, 'user-b'), () => NOW)
    await a.write(record())
    expect([...disk.data.keys()]).toEqual([`u:user-a:draft:${C1}`])
    expect(await b.read(C1)).toBeNull()
    expect(await b.characters()).toEqual([])
    expect(await a.read(C1)).toEqual(record())
  })

  it('o logout (clear do escopo) apaga, e a gravação atrasada depois de fechar não grava', async () => {
    const disk = createMemoryStorage()
    const scoped = scopeStorage(disk, 'user-a')
    const drafts = createPersistedDraftStore(scoped, () => NOW)
    await drafts.write(record())
    await scoped.clear()
    scoped.close()
    await drafts.write(record({ characterId: C2 }))
    expect(disk.data.size).toBe(0)
  })

  it('clear apaga todos os rascunhos', async () => {
    const { drafts, disk } = setup()
    await drafts.write(record())
    await drafts.write(record({ characterId: C2 }))
    disk.data.set('outbox:x', '[]')
    await drafts.clear()
    expect([...disk.data.keys()]).toEqual(['outbox:x'])
  })
})

it('nada vai para o console, nem com o disco quebrado', async () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m =>
    jest.spyOn(console, m).mockImplementation(() => undefined)
  )
  const { drafts, disk } = setup()
  await drafts.write(record())
  disk.data.set(`draft:${C2}`, '{"v":1,"segredo":')
  await drafts.read(C2)
  await drafts.sweep(NOW)
  for (const spy of spies) expect(spy).not.toHaveBeenCalled()
})
