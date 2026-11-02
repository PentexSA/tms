import { effectiveCreationConfig } from '@tms/sheet-core'

import { modelOf } from '../../../test/fixtures'
import {
  chronicleCreationSummary,
  creationSummary,
  newCharacterIntro,
  summaryLine,
} from '../summary'

// T-29: o modo e o orçamento da criação, lidos do template e da crônica

const vtm = modelOf('vtm-v20')

describe('creationSummary', () => {
  it('V20 por pontos: as prioridades, os fixos e o bônus, com os rótulos do template', () => {
    expect(creationSummary(vtm, effectiveCreationConfig(vtm), true)).toEqual({
      mode: 'points',
      parts: [
        'Atributos 7/5/3',
        'Habilidades 13/9/5',
        'Disciplinas 3',
        'Antecedentes 5',
        'Virtudes 7',
        '15 de bônus',
      ],
      approval: true,
    })
  })

  it('a camada da crônica muda os números', () => {
    const s = chronicleCreationSummary(vtm, {
      approval: false,
      defaults: {
        budgets: { attributes: [8, 6, 4], disciplines: 4 },
        freebies: 21,
      },
    })
    expect(s.parts).toEqual([
      'Atributos 8/6/4',
      'Habilidades 13/9/5',
      'Disciplinas 4',
      'Antecedentes 5',
      'Virtudes 7',
      '21 de bônus',
    ])
    expect(summaryLine(s)).toBe(
      'Criação por pontos · Atributos 8/6/4 · Habilidades 13/9/5 · Disciplinas 4 · Antecedentes 5 · Virtudes 7 · 21 de bônus · aprovação desligada'
    )
  })

  it('point-buy (D&D): "<rótulo> 27", sem bônus', () => {
    const dnd = modelOf('dnd5e-2014')
    expect(creationSummary(dnd, effectiveCreationConfig(dnd), false)).toEqual({
      mode: 'points',
      parts: ['Atributos 27'],
      approval: false,
    })
  })

  it('sem `creation` no template ou no modo livre, só o modo', () => {
    const coc = modelOf('coc7e')
    expect(creationSummary(coc, effectiveCreationConfig(coc), true)).toEqual({
      mode: 'free',
      parts: [],
      approval: false,
    })
    const free = chronicleCreationSummary(vtm, {
      approval: true,
      defaults: { mode: 'free' },
    })
    expect(free.mode).toBe('free')
    expect(summaryLine(free)).toBe('Criação livre · o narrador conclui')
    // Padrão da crônica fora do formato: vale o do template
    expect(
      chronicleCreationSummary(vtm, { approval: false, defaults: [1] }).mode
    ).toBe('points')
  })
})

describe('newCharacterIntro', () => {
  it('por pontos diz o orçamento, o modo Criação e a aprovação', () => {
    const s = creationSummary(vtm, effectiveCreationConfig(vtm), true)
    expect(newCharacterIntro(s)).toBe(
      'Esta crônica usa criação por pontos: Atributos 7/5/3 · Habilidades 13/9/5 · Disciplinas 3 · Antecedentes 5 · Virtudes 7 · 15 de bônus. Comece pela identidade; os pontos você distribui depois, na ficha, no modo Criação. O narrador aprova a ficha antes de ela entrar em jogo.'
    )
    expect(
      newCharacterIntro({ ...s, approval: false }).endsWith('no modo Criação.')
    ).toBe(true)
  })

  it('livre diz o modo Editar e quem conclui', () => {
    expect(
      newCharacterIntro({ mode: 'free', parts: [], approval: false })
    ).toBe(
      'Esta crônica usa criação livre, sem conta de pontos. Comece pela identidade; o resto você monta depois, na ficha, no modo Editar. O narrador conclui a criação.'
    )
  })
})
