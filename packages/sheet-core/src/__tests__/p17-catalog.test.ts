/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateTemplate } from '../validate'
import { isSafeText } from '../validate/safe-text'
import { type Json, palette, reference, templates } from './fixtures'

// P17 (N-07): o catálogo de Qualidades e Defeitos de V20, W20 (apêndice de
// Garou) e M20 nos templates. A fixture p17-catalogo.json tem os nomes e os
// custos do catálogo revisado (o anexo do plano P17), sem fontes: cada
// template conserva a contagem de cada lista, cada nome de custo fixo entra
// no `catalogDefaults` com esse custo, e o de custo variável fica sem
// default (abre o passo do custo, N-08), com a faixa na ajuda.

interface Entry {
  readonly name: string
  readonly original: string
  readonly costs: readonly number[]
}
type Lists = Record<'merits' | 'flaws', readonly Entry[]>
const CATALOG = JSON.parse(
  readFileSync(join(import.meta.dir, 'p17-catalogo.json'), 'utf8')
) as { readonly systems: Record<string, Lists> }

const COUNTS: Record<string, { merits: number; flaws: number }> = {
  'vtm-v20': { merits: 63, flaws: 100 },
  'wta-w20': { merits: 55, flaws: 64 },
  'mta-m20': { merits: 9, flaws: 8 },
}
const META = { merits: 'cost', flaws: 'bonus' } as const

interface Defaults {
  readonly meta: string
  readonly value: number
  readonly items: readonly string[]
}
interface ListDef {
  readonly catalog?: readonly string[]
  readonly catalogDefaults?: readonly Defaults[]
  readonly catalogHelp?: Record<string, string>
  readonly item: {
    readonly meta: readonly { id: string; min?: number; max?: number }[]
  }
}
const listOf = (system: string, list: 'merits' | 'flaws'): ListDef => {
  const fields = (templates[system]?.fields ?? {}) as Record<string, Json>
  return fields[list] as unknown as ListDef
}

const LINK = /:\/\/|www\./i

describe('P17: os templates com o catálogo passam nos dois validadores', () => {
  for (const system of Object.keys(COUNTS))
    it(system, () => {
      const t = templates[system]
      expect(validateTemplate(t, palette)).toEqual([])
      expect(reference.validateTemplate(t, palette)).toEqual([])
    })
})

for (const [system, counts] of Object.entries(COUNTS))
  describe(`P17: ${system}`, () => {
    for (const list of ['merits', 'flaws'] as const) {
      const def = listOf(system, list)
      const entries = CATALOG.systems[system]?.[list] ?? []
      const catalog = def.catalog ?? []
      const defaults = def.catalogDefaults ?? []

      it(`${list}: a contagem do anexo, sem nome repetido`, () => {
        expect(entries).toHaveLength(counts[list])
        expect(catalog).toHaveLength(counts[list])
        expect(new Set(catalog).size).toBe(catalog.length)
        expect([...catalog].sort()).toEqual(entries.map(e => e.name).sort())
      })

      it(`${list}: todo nome do catalogDefaults está no catálogo, uma vez`, () => {
        const named = defaults.flatMap(d => d.items)
        expect(named.every(n => catalog.includes(n))).toBe(true)
        expect(new Set(named).size).toBe(named.length)
        expect(defaults.every(d => d.meta === META[list])).toBe(true)
        expect(new Set(defaults.map(d => d.value)).size).toBe(defaults.length)
      })

      it(`${list}: custo fixo com o custo do anexo; variável sem default e com a faixa na ajuda`, () => {
        const meta = def.item.meta.find(m => m.id === META[list])
        for (const e of entries) {
          const got = defaults.filter(d => d.items.includes(e.name))
          if (e.costs.length === 1) {
            expect({ name: e.name, value: got[0]?.value }).toEqual({
              name: e.name,
              value: e.costs[0],
            })
            expect(got).toHaveLength(1)
          } else {
            // Nenhum default esconde a escolha
            expect({ name: e.name, defaults: got.length }).toEqual({
              name: e.name,
              defaults: 0,
            })
            expect(def.catalogHelp?.[e.name]).toBeDefined()
          }
          // Todo custo do anexo cabe na faixa do meta
          for (const c of e.costs) {
            expect(c).toBeGreaterThanOrEqual(meta?.min ?? 0)
            expect(c).toBeLessThanOrEqual(meta?.max ?? 0)
          }
        }
      })

      it(`${list}: a ajuda é do time, curta, sem link, só de nomes do catálogo`, () => {
        for (const [name, text] of Object.entries(def.catalogHelp ?? {})) {
          expect(catalog).toContain(name)
          expect(text.length).toBeLessThanOrEqual(200)
          expect(isSafeText(text)).toBe(true)
          expect(LINK.test(text)).toBe(false)
        }
      })
    }
  })

describe('P17: particularidades do anexo', () => {
  const help = (system: string, list: 'merits' | 'flaws', name: string) =>
    listOf(system, list).catalogHelp?.[name] ?? ''

  it('valores discretos não viram faixa contínua', () => {
    expect(help('wta-w20', 'merits', 'Multi-Metamorfo')).toMatch(/1 ou 5/)
    expect(help('wta-w20', 'flaws', 'Fobia')).toMatch(/2 ou 3/)
    expect(
      help('mta-m20', 'merits', 'Guardião da Tempestade / Viajante Quântico')
    ).toMatch(/3 ou 5/)
  })

  it('a ajuda das opções variáveis diz que o app não confere o valor', () => {
    expect(help('vtm-v20', 'flaws', 'Inimigo')).toMatch(/não confere o valor/)
  })

  it('Fé Verdadeira do M20: o default 7 é um nível, e a ajuda diz', () => {
    const faith = listOf('mta-m20', 'merits').catalogDefaults?.find(d =>
      d.items.includes('Fé Verdadeira')
    )
    expect(faith?.value).toBe(7)
    expect(help('mta-m20', 'merits', 'Fé Verdadeira')).toMatch(/por nível/)
  })

  it('o mesmo nome em dois sistemas não exige o mesmo custo', () => {
    const cost = (system: string, name: string) =>
      listOf(system, 'merits').catalogDefaults?.find(d =>
        d.items.includes(name)
      )?.value
    expect(cost('vtm-v20', 'Aptidão com Computadores')).toBe(2)
    expect(cost('wta-w20', 'Aptidão com Computadores')).toBe(1)
    expect(cost('vtm-v20', 'Líder Nato')).toBe(1)
    expect(cost('wta-w20', 'Líder Nato')).toBe(2)
  })

  it('o catálogo só tem nomes (sem descrição do livro)', () => {
    for (const system of Object.keys(COUNTS))
      for (const list of ['merits', 'flaws'] as const)
        for (const name of listOf(system, list).catalog ?? [])
          expect(name.length).toBeLessThanOrEqual(80)
  })
})
