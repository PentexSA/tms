// Sorteio de inteiros sobre uma fonte de aleatoriedade injetada. O core não
// escolhe a fonte: no servidor e no app é o `getRandomValues` (CSPRNG) da
// plataforma; nos testes, uma sequência fixa.

/** Inteiros uniformes em [0, 2^32). */
export interface RandomSource {
  nextUint32(): number
}

const RANGE = 2 ** 32

/**
 * Inteiro uniforme em [min, max], ambos inclusivos. Amostragem por rejeição:
 * descarta o fim do intervalo de 32 bits que não divide por inteiro, então
 * `x % n` não favorece os valores baixos (sem viés de módulo).
 */
export function randomInt(rng: RandomSource, min: number, max: number): number {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min)
    throw new RangeError('intervalo inválido')
  const n = max - min + 1
  if (n > RANGE) throw new RangeError('intervalo maior que 2^32')
  // Maior múltiplo de n que cabe em 2^32: acima dele, sorteia de novo
  const limit = RANGE - (RANGE % n)
  for (;;) {
    const x = rng.nextUint32()
    if (!Number.isInteger(x) || x < 0 || x >= RANGE)
      throw new RangeError('fonte devolveu valor fora de [0, 2^32)')
    if (x < limit) return min + (x % n)
  }
}

/**
 * Fonte sobre o `getRandomValues` da plataforma (Web Crypto no servidor e
 * no web, expo-crypto no app), em blocos para não chamar a cada dado.
 */
export function cryptoRandom(
  getRandomValues: (array: Uint32Array) => unknown,
  batch = 64
): RandomSource {
  const buffer = new Uint32Array(batch)
  let next = batch
  return {
    nextUint32() {
      if (next >= batch) {
        getRandomValues(buffer)
        next = 0
      }
      const value = buffer[next] as number
      // Cada valor é usado uma vez só
      buffer[next++] = 0
      return value
    },
  }
}
