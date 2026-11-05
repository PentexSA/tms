import { createMemoryStorage, scopeStorage } from '../../sync/kv'
import {
  bonusSeenKey,
  bonusSeenNow,
  markBonusSeen,
  readBonusSeen,
  resetBonusSeenMemory,
} from '../bonusSeen'

// P05-D (U-07): a marca da folha de bônus no aparelho, por usuário. O que
// vem do disco é input hostil; o id só vira chave no formato de UUID

const A = '00000000-0000-4000-8000-00000000a001'
const B = '00000000-0000-4000-8000-00000000b002'
const USER = '00000000-0000-4000-8000-000000000001'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => resetBonusSeenMemory())

describe('bonusSeen', () => {
  it('a chave só aceita o formato de UUID', () => {
    expect(bonusSeenKey(A)).toBe(`seen:bonus:${A}`)
    expect(bonusSeenKey('../outra')).toBeNull()
    expect(bonusSeenKey(`${A}:x`)).toBeNull()
    expect(bonusSeenKey('')).toBeNull()
  })

  it('marca no storage do usuário e lê de volta numa tela nova', async () => {
    const disk = createMemoryStorage()
    const storage = scopeStorage(disk, USER)
    expect(await readBonusSeen(storage, A)).toBe(false)
    markBonusSeen(storage, A)
    expect(bonusSeenNow(storage, A)).toBe(true)
    await flush()
    expect(disk.data.get(`u:${USER}:seen:bonus:${A}`)).toBe('1')
    // Outra montagem (a memória é outra): lê do disco
    const again = scopeStorage(disk, USER)
    expect(bonusSeenNow(again, A)).toBe(false)
    expect(await readBonusSeen(again, A)).toBe(true)
    expect(bonusSeenNow(again, A)).toBe(true)
    // Outra ficha não está marcada
    expect(await readBonusSeen(again, B)).toBe(false)
  })

  it('só "1" vale como marcado', async () => {
    const disk = createMemoryStorage()
    const storage = scopeStorage(disk, USER)
    for (const value of ['0', 'true', '1 ', '{"seen":1}', '']) {
      await disk.setItem(`u:${USER}:seen:bonus:${A}`, value)
      expect(await readBonusSeen(scopeStorage(disk, USER), A)).toBe(false)
    }
    await disk.setItem(`u:${USER}:seen:bonus:${A}`, '1')
    expect(await readBonusSeen(storage, A)).toBe(true)
  })

  it('id fora do formato não vira chave, e fica só na memória', async () => {
    const disk = createMemoryStorage()
    const storage = scopeStorage(disk, USER)
    markBonusSeen(storage, 'nao-uuid')
    await flush()
    expect([...disk.data.keys()]).toEqual([])
    expect(bonusSeenNow(storage, 'nao-uuid')).toBe(true)
  })

  it('o logout (clear) apaga a marca', async () => {
    const disk = createMemoryStorage()
    const storage = scopeStorage(disk, USER)
    markBonusSeen(storage, A)
    await flush()
    await storage.clear()
    expect(disk.data.size).toBe(0)
    // O login seguinte é outro storage: começa sem a marca
    expect(await readBonusSeen(scopeStorage(disk, USER), A)).toBe(false)
  })

  it('disco ilegível vale como não marcado; gravação que falha não quebra', async () => {
    const broken = {
      ...scopeStorage(createMemoryStorage(), USER),
      getItem: () => Promise.reject(new Error('disco')),
      setItem: () => Promise.reject(new Error('disco')),
    }
    expect(await readBonusSeen(broken, A)).toBe(false)
    expect(() => markBonusSeen(broken, A)).not.toThrow()
    await flush()
    expect(bonusSeenNow(broken, A)).toBe(true)
  })

  it('sem storage (sem sessão), só a memória da sessão', async () => {
    markBonusSeen(null, A)
    expect(await readBonusSeen(null, A)).toBe(true)
    expect(await readBonusSeen(null, B)).toBe(false)
    resetBonusSeenMemory()
    expect(await readBonusSeen(null, A)).toBe(false)
  })
})
