import { civilDate, excerpt, paragraphs } from '../format'

/**
 * O trecho da Apresentação (P14-D): o leitor de tela recebe no máximo `max`
 * pontos de código e o "…", nunca o texto inteiro.
 */
describe('excerpt', () => {
  it('should return a short text unchanged, without the ellipsis', () => {
    expect(excerpt('  Uma mesa curta.  ', 140)).toBe('Uma mesa curta.')
  })

  it('should cut at the last space before the limit and add the ellipsis', () => {
    expect(excerpt('alfa beta gama delta', 12)).toBe('alfa beta…')
  })

  it('should collapse line breaks and repeated spaces before cutting', () => {
    expect(excerpt('um\n\ndois   três\r\nquatro', 140)).toBe(
      'um dois três quatro'
    )
    // Os parágrafos em branco não gastam o trecho
    expect(excerpt(`alfa\n\n\n\n${'beta '.repeat(5)}`, 12)).toBe('alfa beta…')
  })

  it('should keep the last word when the limit falls right before a space', () => {
    // "alfa beta" tem 9 pontos, e o 10º é espaço: a palavra está inteira
    expect(excerpt('alfa beta gama', 9)).toBe('alfa beta…')
  })

  it('should cut at the limit when there is no space', () => {
    expect(excerpt('a'.repeat(200), 140)).toBe(`${'a'.repeat(140)}…`)
  })

  it('should never split an emoji or a surrogate pair', () => {
    const cut = excerpt('🜏'.repeat(150), 140)
    expect(Array.from(cut)).toHaveLength(141)
    expect(cut.endsWith('🜏…')).toBe(true)
  })

  it('should keep the excerpt within max code points plus the ellipsis', () => {
    const text = 'Parágrafo de teste do roteiro, número 1. '.repeat(100)
    expect(Array.from(excerpt(text, 140)).length).toBeLessThanOrEqual(141)
  })
})

describe('paragraphs', () => {
  it('should split on blank lines, keeping single line breaks', () => {
    expect(paragraphs('um\nainda um\n\ndois')).toEqual(['um\nainda um', 'dois'])
  })

  it('should accept CRLF and lines with only spaces between paragraphs', () => {
    expect(paragraphs('um\r\n\r\ndois\n  \t\ntrês')).toEqual([
      'um',
      'dois',
      'três',
    ])
  })

  it('should drop extra blank lines and empty paragraphs', () => {
    expect(paragraphs('\n\num\n\n\n\ndois\n\n')).toEqual(['um', 'dois'])
    expect(paragraphs('   ')).toEqual([])
  })

  it('should keep markup characters literal', () => {
    const line = '*não é negrito* [nem link](https://exemplo.test)'
    expect(paragraphs(line)).toEqual([line])
  })
})

/**
 * Data civil (T-16): corta o texto, sem Date, então o resultado é o mesmo em
 * qualquer fuso.
 */
describe('civilDate', () => {
  it('should format a civil date as dd/mm/aaaa', () => {
    expect(civilDate('2026-11-01')).toBe('01/11/2026')
  })

  it('should drop the year when asked', () => {
    expect(civilDate('2026-11-01', { year: false })).toBe('01/11')
  })

  it('should keep the day west of UTC (no Date involved)', () => {
    // Arrange: o jest isola o process.env, então mudar o TZ aqui não chega ao
    // processo. Provamos a propriedade direto: nenhum Date é construído
    const RealDate = global.Date
    const dateSpy = jest.fn(() => {
      throw new Error('civilDate must not build a Date')
    })
    global.Date = dateSpy as unknown as DateConstructor
    try {
      // Act & Assert
      expect(civilDate('2026-11-01')).toBe('01/11/2026')
      expect(dateSpy).not.toHaveBeenCalled()
    } finally {
      global.Date = RealDate
    }
  })

  it.each([
    '2026-13-01',
    '2026-11-00',
    '',
    '2026-11-01T00:00:00Z',
    '01/11/2026',
    'Sat Oct 31 2026',
  ])('should return null outside the format (%p)', value => {
    expect(civilDate(value)).toBeNull()
  })
})
