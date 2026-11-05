import type { CreationInfo } from '../creation'
import {
  markerOf,
  NEXT_STEP_MAX,
  type NextStepInput,
  nextStepCopy,
  readerOf,
} from '../nextStep'

// P04-D (D-03, R-13): o próximo passo na barra, pelo modo da crônica e pelo
// papel de quem lê

describe('nextStepCopy', () => {
  const cases: [NextStepInput, string | null][] = [
    [
      { by: 'owner', mode: 'free', approval: false, marker: null },
      'Quando terminar, avise: o narrador conclui.',
    ],
    [
      { by: 'owner', mode: 'free', approval: true, marker: 'adjust' },
      'Ajuste o pedido do narrador e avise de novo.',
    ],
    [
      { by: 'owner', mode: 'free', approval: false, marker: 'returned' },
      'Ajuste o pedido do narrador e avise de novo.',
    ],
    [
      { by: 'owner', mode: 'free', approval: false, marker: 'ready' },
      'Você avisou. O narrador conclui a criação.',
    ],
    [
      { by: 'owner', mode: 'points', approval: false, marker: null },
      'Você conclui quando a conta fechar.',
    ],
    [
      { by: 'owner', mode: 'points', approval: false, marker: 'adjust' },
      'Ajuste o pedido do narrador e conclua.',
    ],
    [
      { by: 'owner', mode: 'points', approval: true, marker: null },
      'Quando a conta fechar, envie ao narrador.',
    ],
    [
      { by: 'owner', mode: 'points', approval: true, marker: 'returned' },
      'Ajuste o pedido do narrador e envie de novo.',
    ],
    [
      { by: 'storyteller', mode: 'free', approval: false, marker: null },
      'Você conclui a criação.',
    ],
    [{ by: 'other', mode: 'free', approval: false, marker: 'ready' }, null],
    [{ by: 'other', mode: 'points', approval: true, marker: null }, null],
  ]
  it.each(cases)('%j → %s', (input, expected) => {
    expect(nextStepCopy(input)).toBe(expected)
  })

  it(`nenhuma frase passa de ${NEXT_STEP_MAX} caracteres (uma linha a 360 dp)`, () => {
    for (const by of ['owner', 'storyteller', 'other'] as const)
      for (const mode of ['free', 'points'] as const)
        for (const approval of [false, true])
          for (const marker of ['adjust', 'returned', 'ready', null] as const)
            for (const closed of [false, true])
              expect(
                (nextStepCopy({ by, mode, approval, marker, closed }) ?? '')
                  .length
              ).toBeLessThanOrEqual(NEXT_STEP_MAX)
  })

  // P05-D (achado 3 do onda-3 §11): a linha muda quando a conta fecha
  const closedCases: [NextStepInput, string | null][] = [
    [
      {
        by: 'owner',
        mode: 'points',
        approval: false,
        marker: null,
        closed: true,
      },
      'A conta fechou: você conclui.',
    ],
    [
      {
        by: 'owner',
        mode: 'points',
        approval: true,
        marker: null,
        closed: true,
      },
      'A conta fechou: envie ao narrador.',
    ],
    [
      {
        by: 'owner',
        mode: 'points',
        approval: false,
        marker: 'adjust',
        closed: true,
      },
      'Ajuste o pedido do narrador e conclua.',
    ],
    [
      {
        by: 'owner',
        mode: 'points',
        approval: true,
        marker: 'returned',
        closed: true,
      },
      'Ajuste o pedido do narrador e envie de novo.',
    ],
    [
      {
        by: 'storyteller',
        mode: 'points',
        approval: true,
        marker: null,
        closed: true,
      },
      'A conta fechou: você conclui.',
    ],
    // Na criação livre e na ficha alheia, nada muda
    [
      {
        by: 'owner',
        mode: 'free',
        approval: false,
        marker: null,
        closed: true,
      },
      'Quando terminar, avise: o narrador conclui.',
    ],
    [
      {
        by: 'other',
        mode: 'points',
        approval: false,
        marker: null,
        closed: true,
      },
      null,
    ],
  ]
  it.each(closedCases)('conta fechada: %j → %s', (input, expected) => {
    expect(nextStepCopy(input)).toBe(expected)
  })

  it('markerOf segue a precedência do selo; readerOf, os papéis', () => {
    const info = (over: Partial<CreationInfo>) => over as CreationInfo
    const reason = { reason: 'x', at: '2026-11-02' }
    expect(
      markerOf(info({ adjust: reason, returned: reason, ready: { at: 'x' } }))
    ).toBe('adjust')
    expect(markerOf(info({ returned: reason, ready: { at: 'x' } }))).toBe(
      'returned'
    )
    expect(markerOf(info({ ready: { at: 'x' } }))).toBe('ready')
    expect(markerOf(null)).toBeNull()
    expect(readerOf(new Set(['owner']))).toBe('owner')
    expect(readerOf(new Set(['owner', 'storyteller']))).toBe('storyteller')
    expect(readerOf(new Set(['storyteller']))).toBe('other')
    expect(readerOf(new Set())).toBe('other')
  })
})
