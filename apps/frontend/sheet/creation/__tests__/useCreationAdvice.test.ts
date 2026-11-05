import type { AdviceNotice } from '../creation'
import { sameNotices } from '../useCreationAdvice'

// A igualdade rasa do seletor dos avisos (P07-D): a aba de pontos só
// re-renderiza quando um aviso nasce, muda ou some.
const notice = (over: Partial<AdviceNotice> = {}): AdviceNotice => ({
  key: 'ADVICE_OUTSIDE:disciplines',
  kind: 'confirm',
  text: 'Disciplinas: 1 fora do clã.',
  field: 'disciplines',
  paths: ['values.disciplines#d1'],
  ...over,
})

describe('sameNotices', () => {
  it('a mesma lista, ou uma igual campo a campo, é igual', () => {
    const a = [notice()]
    expect(sameNotices(a, a)).toBe(true)
    expect(sameNotices(a, [notice()])).toBe(true)
    expect(sameNotices([], [])).toBe(true)
  })

  it('outro tamanho, outra chave, outro texto ou outros caminhos: diferente', () => {
    const a = [notice()]
    expect(sameNotices(a, [])).toBe(false)
    expect(sameNotices(a, [notice({ key: 'x' })])).toBe(false)
    expect(
      sameNotices(a, [notice({ text: 'Disciplinas: 2 fora do clã.' })])
    ).toBe(false)
    expect(sameNotices(a, [notice({ paths: ['values.disciplines#d2'] })])).toBe(
      false
    )
  })
})
