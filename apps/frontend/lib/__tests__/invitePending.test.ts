import {
  clearPendingInvite,
  hasPendingInvite,
  PENDING_INVITE_TTL_MS,
  peekPendingInvite,
  setPendingInvite,
  subscribePendingInvite,
} from '../invite/pending'

// P12, D-14: o código do link fica só em memória, por 30 min.
const CODE = 'ABCD2345EFGH6789JKMN0PQRST'

beforeEach(() => clearPendingInvite())
afterEach(() => jest.useRealTimers())

describe('convite pendente', () => {
  it('peek não consome: duas leituras, o mesmo código', () => {
    setPendingInvite(CODE)
    expect(peekPendingInvite()).toBe(CODE)
    expect(peekPendingInvite()).toBe(CODE)
    expect(hasPendingInvite()).toBe(true)
  })

  it('some depois de 30 min e avisa quem assina; a leitura não muda nada', () => {
    jest.useFakeTimers()
    const listener = jest.fn()
    const stop = subscribePendingInvite(listener)
    setPendingInvite(CODE)
    listener.mockClear()
    jest.advanceTimersByTime(PENDING_INVITE_TTL_MS - 1)
    expect(peekPendingInvite()).toBe(CODE)
    expect(listener).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(peekPendingInvite()).toBeNull()
    expect(hasPendingInvite()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
  })

  it('um código novo renova a validade', () => {
    jest.useFakeTimers()
    setPendingInvite(CODE)
    jest.advanceTimersByTime(PENDING_INVITE_TTL_MS - 10)
    setPendingInvite('OUTRO')
    jest.advanceTimersByTime(20)
    expect(peekPendingInvite()).toBe('OUTRO')
  })

  it('clear apaga e avisa quem assina; o novo substitui o velho', () => {
    const listener = jest.fn()
    const stop = subscribePendingInvite(listener)
    setPendingInvite(CODE)
    setPendingInvite('OUTRO')
    expect(peekPendingInvite()).toBe('OUTRO')
    clearPendingInvite()
    expect(peekPendingInvite()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(3)
    // Limpar de novo, sem nada: sem aviso
    clearPendingInvite()
    expect(listener).toHaveBeenCalledTimes(3)
    stop()
    setPendingInvite(CODE)
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
