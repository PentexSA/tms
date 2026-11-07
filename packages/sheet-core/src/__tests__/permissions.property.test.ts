/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { compileTemplate } from '../compile'
import { canRead, canWrite, revealableSections } from '../permissions'
import { templates } from './fixtures'

// U-11 (P16-D): a revelação nunca dá escrita e nunca dá leitura fora das
// seções reveláveis, para qualquer papel, campo e lista de seções.

const KEYS = [
  'vtm-v20',
  'wta-w20',
  'mta-m20',
  'dnd5e-2014',
  'coc7e',
  'fate-core',
]
const models = KEYS.map(k => compileTemplate(templates[k]))
const ROLES = ['owner', 'storyteller', 'viewer', 'player', 'admin', '']

describe('revelação: propriedades', () => {
  it('nunca dá escrita, e só abre seção revelável ao dono', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...models),
        fc.subarray(ROLES),
        fc.array(fc.string({ maxLength: 12 }), { maxLength: 4 }),
        fc.boolean(),
        fc.nat(),
        (model, roles, junk, withStoryteller, pick) => {
          const sections = [...model.sections.keys()]
          const revealed = [
            ...junk,
            sections[pick % sections.length] ?? '',
            ...(withStoryteller ? ['storyteller'] : []),
          ]
          const allowed = new Set(revealableSections(model))
          for (const id of model.fields.keys()) {
            const before = canRead(model, id, roles)
            const after = canRead(model, id, roles, revealed)
            // escrever exige ler sem a revelação: a lista nunca dá escrita
            if (canWrite(model, id, roles)) expect(before).toBe(true)
            if (after === before) continue
            // ganhou leitura: só o dono, e só por seção revelável na lista
            expect(after).toBe(true)
            expect(roles.includes('owner')).toBe(true)
            const field = model.fields.get(id)
            expect(
              field?.sectionIds.some(
                s => allowed.has(s) && revealed.includes(s)
              )
            ).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
