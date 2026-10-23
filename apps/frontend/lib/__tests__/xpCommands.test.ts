import { createMemoryStorage } from '../../sheet/sync/kv'
import {
  createXpCommandStore,
  parseXpCommand,
  withKey,
  type XpCommand,
} from '../xpCommands'

const command = (overrides: Partial<XpCommand> = {}): XpCommand => ({
  key: '00000000-0000-4000-8000-000000000001',
  kind: 'request',
  chronicleId: '00000000-0000-4000-8000-000000000002',
  characterId: '00000000-0000-4000-8000-000000000003',
  body: { field: 'str', to: 3 },
  label: 'Pedir Força',
  at: 10,
  ...overrides,
})

describe('comandos persistidos de XP', () => {
  it('salva a intenção inteira e a relê na ordem original', async () => {
    const storage = createMemoryStorage()
    const store = createXpCommandStore(storage)
    const later = command({
      key: '00000000-0000-4000-8000-000000000004',
      at: 20,
    })
    await store.save(later)
    await store.save(command())
    expect(await store.list()).toEqual([command(), later])
    await store.remove(command().key)
    expect(await store.list()).toEqual([later])
  })

  it('descarta do disco uma entrada adulterada', async () => {
    const storage = createMemoryStorage()
    await storage.setItem('xp-command:invalida', '{"key":"invalida"}')
    const store = createXpCommandStore(storage)
    expect(await store.list()).toEqual([])
    expect(await storage.keys('xp-command:')).toEqual([])
  })

  it('valida ids, corpo e tamanho dos textos lidos do aparelho', () => {
    expect(parseXpCommand(command())).toEqual(command())
    expect(parseXpCommand({ ...command(), key: 'não-é-uuid' })).toBeNull()
    expect(parseXpCommand({ ...command(), body: [] })).toBeNull()
    expect(parseXpCommand({ ...command(), label: 'x'.repeat(201) })).toBeNull()
  })

  it('usa a mesma chave no campo de idempotência de cada rota', () => {
    expect(withKey(command())).toMatchObject({
      field: 'str',
      clientRequestId: command().key,
    })
    expect(withKey(command({ kind: 'grant' }))).toMatchObject({
      clientOperationId: command().key,
    })
    expect(withKey(command({ kind: 'approve' }))).toMatchObject({
      decisionKey: command().key,
    })
  })
})
