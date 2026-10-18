/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import { PALETTE } from '../palette'
import { parseSheet, parseTemplate } from '../parse'
import { character, palette, templates, vtm } from './fixtures'

describe('parse', () => {
  it('a paleta gerada é a de tokens.json (rode build.mjs se falhar)', () => {
    expect<readonly string[]>(PALETTE).toEqual(palette)
  })

  it('parseTemplate devolve o template tipado só quando é válido', () => {
    const ok = parseTemplate(templates['vtm-v20'])
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.value.system).toBe('vtm-v20')

    const t = vtm()
    t.skin = 'neon'
    const bad = parseTemplate(t)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.issues.map(i => i.path)).toEqual(['skin'])
  })

  it('parseTemplate aceita outra paleta (testes da paleta)', () => {
    expect(parseTemplate(templates['vtm-v20'], []).ok).toBe(false)
  })

  it('parseSheet valida a ficha contra o modelo', () => {
    const model = compileTemplate(templates['vtm-v20'])
    const c = character('helena')
    expect<unknown>(parseSheet(model, c.sheet)).toEqual({
      ok: true,
      value: c.sheet,
    })

    c.sheet.values.strength = 6
    const bad = parseSheet(model, c.sheet)
    expect(bad).toEqual({
      ok: false,
      issues: [{ path: 'values.strength', message: 'acima do máximo 5' }],
    })
  })
})
