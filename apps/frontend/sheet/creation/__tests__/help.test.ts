import { templateJson } from '../../../test/fixtures'
import { CREATION_HELP } from '../help'

// R-19 (P10-D §3.7, revisão): as frases do app servem a qualquer sistema que
// use a regra do motor, então não citam grupo, seção nem campo de template.
type Json = Record<string, unknown>
const SYSTEMS = [
  'vtm-v20',
  'wta-w20',
  'mta-m20',
  'dnd5e-2014',
  'coc7e',
  'fate-core',
]

function templateNames(): string[] {
  const names = new Set<string>()
  for (const system of SYSTEMS) {
    const t = templateJson(system)
    for (const s of t.sections as Json[]) {
      names.add(s.title as string)
      for (const g of (s.groups ?? []) as Json[]) names.add(g.title as string)
    }
    for (const f of Object.values(t.fields as Record<string, Json>))
      names.add(f.label as string)
  }
  return [...names].filter(n => n.length > 3)
}

describe('frases do app: genéricas', () => {
  it.each(Object.entries(CREATION_HELP))(
    '%s não cita nome de template nem número',
    (_, { text }) => {
      const cited = templateNames().filter(n =>
        new RegExp(
          `\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i'
        ).test(text)
      )
      expect(cited).toEqual([])
      expect(text).not.toMatch(/\d/)
      expect(text.length).toBeLessThanOrEqual(200)
    }
  )
})
