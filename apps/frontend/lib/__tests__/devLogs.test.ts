import { LogBox } from 'react-native'
import { IGNORED_DEV_LOGS, quietDevLogs } from '../devLogs'

// O módulo chama quietDevLogs() ao carregar (index.ts); aqui, de novo

// O LogBox ignora por prefixo/substring: a lista só pode ter as frases
// exatas dos avisos de terceiros, nunca algo genérico que esconda um erro
// nosso
describe('quietDevLogs', () => {
  it('tira da tela só as frases da lista', () => {
    const spy = jest
      .spyOn(LogBox, 'ignoreLogs')
      .mockImplementation(() => undefined)
    quietDevLogs()
    expect(spy).toHaveBeenCalledWith([...IGNORED_DEV_LOGS])
    spy.mockRestore()
  })

  it('cada frase é longa e específica', () => {
    for (const phrase of IGNORED_DEV_LOGS) {
      expect(phrase.length).toBeGreaterThan(40)
      expect(phrase).not.toMatch(/^(error|warning|warn)\b/i)
    }
  })

  it('não cobre o aviso do usePreventRemove (este se corrige no código)', () => {
    const message =
      '`repeat` or `disablePrevention` from `usePreventRemove` was called, but `preventRemove` is still `true`.'
    expect(IGNORED_DEV_LOGS.some(p => message.includes(p))).toBe(false)
  })
})
