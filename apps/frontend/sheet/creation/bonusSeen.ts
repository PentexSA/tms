import type { UserStorage } from '../sync/kv'

// A marca "a ficha já passou pela fase de bônus" (P05-D, U-07): a folha
// "Começaram os pontos de bônus" aparece só na primeira passagem de cada
// ficha. A marca fica no aparelho, no storage do usuário (cifrado no
// nativo, IndexedDB no web), ao lado dos rascunhos e do outbox, e sai no
// logout com o resto dele. Ela não decide nada além de abrir ou não uma
// folha de aviso: o pior caso de uma marca perdida ou adulterada é a folha
// aparecer mais uma vez. Só o id da ficha; nada de PII.

// O id vem do servidor; mesmo assim, só o formato de UUID vira chave
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SEEN = '1'

/** A chave da marca; null para um id fora do formato. */
export function bonusSeenKey(characterId: string): string | null {
  return UUID.test(characterId) ? `seen:bonus:${characterId}` : null
}

// A memória da sessão, por storage: trocar de modo não lê o disco de novo, e
// um login novo (outro storage) começa do zero. Sem storage (testes, sem
// sessão), só a memória
const memory = new WeakMap<UserStorage, Set<string>>()
let detached = new Set<string>()

const memoryOf = (storage: UserStorage | null): Set<string> => {
  if (!storage) return detached
  let seen = memory.get(storage)
  if (!seen) {
    seen = new Set()
    memory.set(storage, seen)
  }
  return seen
}

/** Já passou? O que vem do disco é input hostil: só "1" vale como marcado. */
export async function readBonusSeen(
  storage: UserStorage | null,
  characterId: string
): Promise<boolean> {
  const seen = memoryOf(storage)
  if (seen.has(characterId)) return true
  const key = bonusSeenKey(characterId)
  if (!storage || !key) return false
  try {
    if ((await storage.getItem(key)) !== SEEN) return false
  } catch {
    // Disco ilegível: vale como não marcado (só o aviso aparece de novo)
    return false
  }
  seen.add(characterId)
  return true
}

/** Já passou, de forma síncrona: só a memória da sessão. */
export function bonusSeenNow(
  storage: UserStorage | null,
  characterId: string
): boolean {
  return memoryOf(storage).has(characterId)
}

/** Marca a ficha (quando a folha abre). Uma falha de gravação não quebra. */
export function markBonusSeen(
  storage: UserStorage | null,
  characterId: string
): void {
  memoryOf(storage).add(characterId)
  const key = bonusSeenKey(characterId)
  if (!storage || !key) return
  storage.setItem(key, SEEN).catch(() => undefined)
}

/** Só para testes: esquece a memória sem storage. */
export function resetBonusSeenMemory(): void {
  detached = new Set()
}
