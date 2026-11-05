/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isSafeText } from '../validate/safe-text'
import { type Json, templates } from './fixtures'

// R-19 (P10-D, commit 8): as frases do time em
// doc/planos-pacotes/P10-D-frases.json, conferidas contra os templates. Cada
// frase está no caminho que a lista diz, com o mesmo texto, até 200
// caracteres, sem link e sem marcação. As do catálogo entram com o commit 7
// (sobre a forma do catálogo do P07-D): aqui só se confere que o nome existe.

interface Phrase {
  readonly label?: string
  readonly acao?: string
  readonly help: string | null
  readonly atual?: string
}
interface SystemPhrases {
  readonly templateVersion: string
  readonly fields: Record<string, Phrase>
  readonly groups: Record<string, Phrase>
  readonly options: Record<string, Record<string, Phrase>>
  // Nome do item → frase
  readonly catalog: Record<string, Record<string, string>>
  readonly label?: Record<string, { label: string; placeholder?: string }>
}
const PHRASES = JSON.parse(
  readFileSync(
    join(import.meta.dir, '../../../../doc/planos-pacotes/P10-D-frases.json'),
    'utf8'
  )
) as {
  readonly status: string
  readonly app: Record<string, { help: string }>
  readonly templates: Record<string, SystemPhrases>
}

const LINK = /:\/\/|www\./i
const shortOk = (text: string) =>
  text.length > 0 &&
  text.length <= 200 &&
  isSafeText(text) &&
  !/[\t\n\r]/.test(text) &&
  !LINK.test(text)

type Fields = Record<string, Json>
const sectionGroup = (t: Json, key: string): Json | undefined => {
  const [, sid, , gid] = key.split('.')
  const s = (t.sections as Json[]).find(x => x.id === sid)
  return ((s?.groups ?? []) as Json[]).find(g => g.id === gid)
}

describe('P10-D-frases.json', () => {
  it('é rascunho do time, para revisão', () => {
    expect(PHRASES.status).toBe('rascunho do time, para revisão')
  })

  it('as frases do app cabem na frase curta', () => {
    for (const p of Object.values(PHRASES.app))
      expect(shortOk(p.help)).toBe(true)
  })
})

for (const [system, data] of Object.entries(PHRASES.templates)) {
  describe(`frases do ${system} no template`, () => {
    const t = templates[system] as Json
    const fields = t.fields as Fields

    it('a lista é da versão do template', () => {
      expect(t.templateVersion).toBe(data.templateVersion)
    })

    it('campos: o caminho existe, e o help segue a ação da lista', () => {
      for (const [id, p] of Object.entries(data.fields)) {
        const f = fields[id]
        expect({ id, exists: Boolean(f) }).toEqual({ id, exists: true })
        if (p.acao === 'mantém') {
          expect({ id, help: f?.help }).toEqual({ id, help: p.atual })
          continue
        }
        // A Fraqueza é do P07-D (o resumo do clã muda o sentido da frase)
        if (p.acao?.includes('P07-D')) continue
        expect({ id, help: f?.help }).toEqual({ id, help: p.help })
        expect({ id, ok: shortOk(p.help ?? '') }).toEqual({ id, ok: true })
      }
    })

    it('grupos: cada frase está no grupo da lista', () => {
      for (const [key, p] of Object.entries(data.groups)) {
        const g = sectionGroup(t, key)
        expect({ key, help: g?.help }).toEqual({ key, help: p.help })
        expect({ key, ok: shortOk(p.help ?? '') }).toEqual({ key, ok: true })
      }
    })

    it('opções: as ids batem com o template, e cada uma tem a frase', () => {
      for (const [id, options] of Object.entries(data.options)) {
        const list = (fields[id]?.options ?? []) as Json[]
        expect(list.map(o => o.id).sort()).toEqual(Object.keys(options).sort())
        for (const o of list) {
          const p = options[o.id as string]
          expect({ id: o.id, help: o.help }).toEqual({
            id: o.id,
            help: p?.help,
          })
          expect({ id: o.id, ok: shortOk(p?.help ?? '') }).toEqual({
            id: o.id,
            ok: true,
          })
        }
      }
    })

    it('catálogo: os nomes existem (a frase entra com o commit 7)', () => {
      for (const [id, names] of Object.entries(data.catalog)) {
        const catalog = (fields[id]?.catalog ?? []) as string[]
        expect(Object.keys(names).sort()).toEqual([...catalog].sort())
        for (const text of Object.values(names))
          expect(shortOk(text)).toBe(true)
      }
    })

    it('rótulos que a lista muda já estão no template', () => {
      for (const [id, l] of Object.entries(data.label ?? {})) {
        expect(fields[id]?.label).toBe(l.label)
        if (l.placeholder) expect(fields[id]?.placeholder).toBe(l.placeholder)
      }
    })
  })
}
