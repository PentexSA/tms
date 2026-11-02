import { civilDate } from '../format'

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
