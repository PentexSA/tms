/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { cryptoRandom, type RandomSource, randomInt } from '../random'

// Etapa 21: sorteio sem viés de módulo (amostragem por rejeição).

const MAX = 2 ** 32 - 1
const fixed = (values: readonly number[]): RandomSource & { used: number } => {
  let i = 0
  return {
    get used() {
      return i
    },
    nextUint32() {
      const v = values[i++]
      if (v === undefined) throw new Error('sequência acabou')
      return v
    },
  }
}

describe('randomInt', () => {
  it('mapeia o começo do intervalo de 32 bits', () => {
    expect(randomInt(fixed([0]), 1, 10)).toBe(1)
    expect(randomInt(fixed([9]), 1, 10)).toBe(10)
    expect(randomInt(fixed([10]), 1, 10)).toBe(1)
  })

  it('rejeita o fim que não divide por inteiro (sem viés de módulo)', () => {
    // 2^32 = 429496729 × 10 + 6: os 6 últimos valores são descartados
    const limit = 2 ** 32 - (2 ** 32 % 10)
    expect(limit).toBe(4294967290)
    // O último aceito ainda vale
    expect(randomInt(fixed([limit - 1]), 1, 10)).toBe(10)
    // Do limite até 2^32 − 1, sorteia de novo
    for (const rejected of [limit, limit + 3, MAX]) {
      const rng = fixed([rejected, 4])
      expect(randomInt(rng, 1, 10)).toBe(5)
      expect(rng.used).toBe(2)
    }
  })

  it('intervalo de um valor só e intervalo de 2^32', () => {
    expect(randomInt(fixed([MAX]), 7, 7)).toBe(7)
    expect(randomInt(fixed([MAX]), 0, MAX)).toBe(MAX)
    expect(randomInt(fixed([0]), 0, MAX)).toBe(0)
  })

  it('intervalo inválido e fonte fora do contrato lançam', () => {
    expect(() => randomInt(fixed([0]), 5, 4)).toThrow(RangeError)
    expect(() => randomInt(fixed([0]), 0.5, 4)).toThrow(RangeError)
    expect(() => randomInt(fixed([0]), 0, 2 ** 32)).toThrow('2^32')
    expect(() => randomInt(fixed([-1]), 1, 6)).toThrow('fora de')
    expect(() => randomInt(fixed([2 ** 32]), 1, 6)).toThrow('fora de')
    expect(() => randomInt(fixed([1.5]), 1, 6)).toThrow('fora de')
  })

  it('propriedade: sempre dentro de [min, max]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.array(fc.integer({ min: 0, max: MAX }), {
          minLength: 4,
          maxLength: 4,
        }),
        (min, span, values) => {
          // Um valor aceito garantido no fim (0 sempre passa)
          const n = randomInt(fixed([...values, 0]), min, min + span)
          return n >= min && n <= min + span
        }
      )
    )
  })

  it('a distribuição dos d10 é uniforme com a fonte real', () => {
    const rng = cryptoRandom(a => crypto.getRandomValues(a))
    const counts = Array.from({ length: 10 }, () => 0)
    const n = 50_000
    for (let i = 0; i < n; i++) {
      const face = randomInt(rng, 1, 10)
      counts[face - 1] = (counts[face - 1] ?? 0) + 1
    }
    // Qui-quadrado com 9 graus de liberdade: p < 0,001 acima de 27,9
    const expected = n / 10
    const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0)
    expect(chi).toBeLessThan(27.9)
  })
})

describe('cryptoRandom', () => {
  it('pede blocos e usa cada valor uma vez', () => {
    let calls = 0
    const rng = cryptoRandom(a => {
      calls++
      for (let i = 0; i < a.length; i++) a[i] = calls * 100 + i
    }, 3)
    expect([1, 2, 3, 4].map(() => rng.nextUint32())).toEqual([
      100, 101, 102, 200,
    ])
    expect(calls).toBe(2)
  })
})
