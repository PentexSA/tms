import { captureInvite, installInviteCapture } from '../invite/capture.web'
import { clearPendingInvite, peekPendingInvite } from '../invite/pending'

// P12, D-14: no web, o código sai de /join#… antes do roteador e do error
// tracking. Uma página falsa (location e history) no lugar do navegador.
const CODE = 'ABCD2345EFGH6789JKMN0PQRST'

function fakePage(href: string) {
  const url = new URL(href)
  const listeners: Record<string, (() => void)[]> = {}
  const page = {
    location: { pathname: url.pathname, hash: url.hash },
    history: {
      state: { key: 'k' },
      replaceState: jest.fn((_state: unknown, _unused: string, to?: string) => {
        const next = new URL(to ?? '', 'https://tms.test')
        page.location = { pathname: next.pathname, hash: next.hash }
      }),
    },
    addEventListener: (type: string, listener: () => void) => {
      listeners[type] = [...(listeners[type] ?? []), listener]
    },
    fire: (type: string) => {
      for (const listener of listeners[type] ?? []) listener()
    },
    go: (to: string) => {
      const next = new URL(to)
      page.location = { pathname: next.pathname, hash: next.hash }
    },
  }
  return page
}

beforeEach(() => clearPendingInvite())

describe('captureInvite', () => {
  it('guarda o código e tira o fragmento da URL, com o mesmo estado', () => {
    const page = fakePage(`https://tms.test/join#${CODE}`)
    captureInvite(page.location, page.history)
    expect(peekPendingInvite()).toBe(CODE)
    expect(page.history.replaceState).toHaveBeenCalledWith(
      { key: 'k' },
      '',
      '/join'
    )
    expect(page.location.hash).toBe('')
  })

  it('/join#lixo também sai da URL, sem guardar nada', () => {
    const page = fakePage('https://tms.test/join#a/b?c')
    captureInvite(page.location, page.history)
    expect(peekPendingInvite()).toBeNull()
    expect(page.history.replaceState).toHaveBeenCalledTimes(1)
    expect(page.location.hash).toBe('')
  })

  it('outra rota com fragmento não é tocada', () => {
    const page = fakePage(`https://tms.test/chronicles/x#${CODE}`)
    captureInvite(page.location, page.history)
    expect(peekPendingInvite()).toBeNull()
    expect(page.history.replaceState).not.toHaveBeenCalled()
  })

  it('/join sem fragmento não é tocado', () => {
    const page = fakePage('https://tms.test/join')
    captureInvite(page.location, page.history)
    expect(page.history.replaceState).not.toHaveBeenCalled()
  })
})

describe('installInviteCapture', () => {
  it('lê ao instalar e de novo quando o fragmento muda na mesma página', () => {
    const page = fakePage(`https://tms.test/join#${CODE}`)
    installInviteCapture(page)
    expect(peekPendingInvite()).toBe(CODE)
    const other = 'ZYXW9876VTSR5432QPNM1KJHGF'
    page.go(`https://tms.test/join#${other}`)
    // O popstate vem antes do hashchange: o primeiro já tira o código
    page.fire('popstate')
    expect(peekPendingInvite()).toBe(other)
    expect(page.location.hash).toBe('')
    page.fire('hashchange')
    expect(page.history.replaceState).toHaveBeenCalledTimes(2)
  })
})
