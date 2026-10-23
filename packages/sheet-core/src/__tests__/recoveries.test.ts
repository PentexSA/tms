/// <reference types="bun-types" />
import { describe, expect, it } from 'bun:test'
import { compileTemplate } from '../compile'
import type { SheetData } from '../contract'
import { applyBatch } from '../events'
import { invertBatch } from '../group'
import { planRecovery } from '../recoveries'
import { validateTemplate } from '../validate'
import {
  character,
  clone,
  dnd,
  type Json,
  palette,
  reference,
  templates,
  vtm,
} from './fixtures'

describe('períodos declarados nos templates', () => {
  for (const [system, fixture] of [
    ['vtm-v20', 'helena'],
    ['mta-m20', 'tomas'],
    ['wta-w20', 'iara'],
  ] as const) {
    const model = compileTemplate(templates[system])
    for (const recovery of model.template.recoveries ?? []) {
      it(`${system}: ${recovery.label}, prévia e reversão exata da ficha de exemplo`, () => {
        const sheet = character(fixture).sheet as unknown as SheetData
        const plan = planRecovery(model, sheet, recovery.id)
        expect(plan.ok).toBe(true)
        if (!plan.ok) return
        expect(plan.preview.length).toBeGreaterThan(0)
        const applied = applyBatch(model, sheet, { events: plan.events }, [
          'storyteller',
        ])
        expect(applied.ok).toBe(true)
        if (!applied.ok) return
        const inverse = invertBatch(
          model,
          applied.sheet,
          plan.events.map(e => ({ ...e, fromAbsent: e.from === null }))
        )
        expect(inverse.ok).toBe(true)
        if (!inverse.ok) return
        const reverted = applyBatch(
          model,
          applied.sheet,
          { events: inverse.events },
          ['storyteller']
        )
        expect(reverted.ok && reverted.sheet).toEqual(sheet)
      })
    }
  }

  it('enche o temporário sem alterar o permanente nem os outros traços', () => {
    const model = compileTemplate(templates['vtm-v20'])
    const sheet = {
      schema: 1,
      values: { courage: 4, willpower: { current: 1, permanent: 4 } },
    } as SheetData
    const plan = planRecovery(model, sheet, 'storyEnd')
    expect(plan.ok && plan.events).toEqual([
      {
        path: 'values.willpower',
        from: { current: 1, permanent: 4 },
        to: { current: 4, permanent: 4 },
      },
    ])
  })

  it('efeitos sucessivos no mesmo campo viram um evento, com o from original', () => {
    const t = vtm()
    t.recoveries = [
      {
        id: 'rest',
        label: 'Descanso',
        help: 'Recuperação composta.',
        effects: [
          {
            effect: 'resource.gain',
            params: { field: 'willpower', amount: 1 },
          },
          { effect: 'resource.restore', params: { field: 'willpower' } },
        ],
      },
    ]
    const plan = planRecovery(
      compileTemplate(t),
      character('helena').sheet as unknown as SheetData,
      'rest'
    )
    expect(plan.ok && plan.events).toEqual([
      {
        path: 'values.willpower',
        from: { current: 5, permanent: 7 },
        to: { current: 7, permanent: 7 },
      },
    ])
  })

  it('um efeito já no máximo não cancela os outros efeitos', () => {
    const t = vtm()
    t.recoveries = [
      {
        id: 'night',
        label: 'Noite',
        help: 'Recuperação composta.',
        effects: [
          { effect: 'resource.restore', params: { field: 'willpower' } },
          { effect: 'resource.spend', params: { field: 'blood', amount: 1 } },
        ],
      },
    ]
    const sheet = {
      schema: 1,
      values: { courage: 4, blood: { current: 5 } },
    } as SheetData
    const plan = planRecovery(compileTemplate(t), sheet, 'night')
    expect(plan.ok && plan.events.map(e => e.path)).toEqual(['values.blood'])
    expect(planRecovery(compileTemplate(t), sheet, 'missing').ok).toBe(false)
    expect(
      planRecovery(compileTemplate(templates['vtm-v20']), sheet, 'storyEnd')
    ).toEqual({ ok: false, reason: 'Nada a recuperar neste período' })
  })

  it('D&D: rest.long fica indisponível com motivo e sem aplicar efeitos parciais', () => {
    const t = dnd()
    const sheet = character('lia').sheet as unknown as SheetData
    const before = clone(sheet)
    expect(planRecovery(compileTemplate(t), sheet, 'longRest')).toEqual({
      ok: false,
      reason: 'Ainda não disponível nesta versão',
    })
    expect(sheet).toEqual(before)
  })
})

describe('validação de recoveries nas duas implementações', () => {
  const base = () => ({
    id: 'rest',
    label: 'Descanso',
    help: 'Recuperação.',
    effects: [{ effect: 'resource.restore', params: { field: 'willpower' } }],
  })
  for (const [name, mutate] of [
    [
      'efeito fora da lista',
      (r: Json) => {
        r.effects = [{ effect: 'code.execute' }]
      },
    ],
    [
      'parâmetro inesperado',
      (r: Json) => {
        r.effects = [
          {
            effect: 'resource.restore',
            params: { field: 'willpower', amount: 1 },
          },
        ]
      },
    ],
    [
      'recurso sem permanente',
      (r: Json) => {
        r.effects = [{ effect: 'resource.restore', params: { field: 'blood' } }]
      },
    ],
    [
      'quantidade ausente',
      (r: Json) => {
        r.effects = [
          { effect: 'resource.gain', params: { field: 'willpower' } },
        ]
      },
    ],
    [
      'efeitos vazios',
      (r: Json) => {
        r.effects = []
      },
    ],
    [
      'id reservado',
      (r: Json) => {
        r.id = 'constructor'
      },
    ],
    [
      'chave desconhecida',
      (r: Json) => {
        r.onclick = 'run'
      },
    ],
  ] as const) {
    it(`recusa ${name}`, () => {
      const t = vtm()
      const r: Json = base()
      mutate(r)
      t.recoveries = [r]
      expect(
        validateTemplate(t, palette).some(e => e.path.startsWith('recoveries'))
      ).toBe(true)
      expect(
        reference
          .validateTemplate(t, palette)
          .some(e => e.includes('recoveries'))
      ).toBe(true)
    })
  }
})
