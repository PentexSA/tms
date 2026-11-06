import { renderHook } from '@testing-library/react-native'
import { costOf, type SheetData } from '@tms/sheet-core'
import { sheetFor } from '../../../test/fixtures'
import * as candidatesModule from '../candidates'
import { useXpShortcutValue } from '../XpShortcut'

// U-01: o atalho só aparece quando o pedido pode ser feito agora.

const { model, sheet } = sheetFor('helena', ['owner'])
const withValues = (values: Record<string, unknown>): SheetData =>
  ({ ...sheet, values: { ...sheet.values, ...values } }) as SheetData

describe('useXpShortcutValue', () => {
  it('só oferece o traço com custo agora: no máximo, nada de atalho', () => {
    const maxed = withValues({ strength: 5 })
    expect(costOf(model, maxed, { field: 'strength' }).ok).toBe(false)
    const { result } = renderHook(() =>
      useXpShortcutValue(true, model, maxed, jest.fn())
    )
    expect(result.current?.offers({ target: { field: 'strength' } })).toBe(
      false
    )
    expect(result.current?.offers({ target: { field: 'dexterity' } })).toBe(
      true
    )
    // Um traço sem regra de XP nunca
    expect(result.current?.offers({ target: { field: 'concept' } })).toBe(false)
  })

  it('a lista: oferece a busca se algum item dela pode ser pedido', () => {
    const { result } = renderHook(() =>
      useXpShortcutValue(true, model, sheet, jest.fn())
    )
    expect(
      result.current?.offers({ query: 'Disciplinas', field: 'disciplines' })
    ).toBe(true)
  })

  it('calcula sob demanda: a ficha nova não recalcula a lista; a lista só olha o próprio campo', () => {
    const spy = jest.spyOn(candidatesModule, 'xpCandidates')
    try {
      const { result, rerender } = renderHook(
        ({ s }: { s: SheetData }) =>
          useXpShortcutValue(true, model, s, jest.fn()),
        { initialProps: { s: sheet } }
      )
      rerender({ s: withValues({ blood: { current: 3 } }) })
      expect(spy).not.toHaveBeenCalled()
      result.current?.offers({ target: { field: 'dexterity' } })
      expect(spy).not.toHaveBeenCalled()
      result.current?.offers({ query: 'Disciplinas', field: 'disciplines' })
      expect(spy).toHaveBeenCalledWith(model, expect.anything(), 'disciplines')
    } finally {
      spy.mockRestore()
    }
  })

  it('desligado ou sem ficha: nulo', () => {
    const { result } = renderHook(() =>
      useXpShortcutValue(false, model, sheet, jest.fn())
    )
    expect(result.current).toBeNull()
  })
})
