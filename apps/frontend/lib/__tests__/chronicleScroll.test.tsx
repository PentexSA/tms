import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react-native'
import { json, memoryStore, testSession, tokens } from '../../test/session'
import {
  clearChronicleScroll,
  rememberScroll,
  scrollOf,
} from '../chronicleScroll'
import { SessionProvider } from '../session/SessionProvider'

// T-39 (P09-C): a rolagem de cada aba da crônica, só em memória

afterEach(() => clearChronicleScroll())

describe('rolagem por crônica e aba', () => {
  it('guarda por crônica e aba; o topo e valores inválidos apagam', () => {
    rememberScroll('c1', 'table', 480)
    rememberScroll('c1', 'sheets', 120)
    rememberScroll('c2', 'table', 900)
    expect(scrollOf('c1', 'table')).toBe(480)
    expect(scrollOf('c1', 'sheets')).toBe(120)
    expect(scrollOf('c2', 'table')).toBe(900)
    expect(scrollOf('c1', 'backstage')).toBe(0)
    rememberScroll('c1', 'table', 0)
    expect(scrollOf('c1', 'table')).toBe(0)
    rememberScroll('c1', 'sheets', Number.NaN)
    expect(scrollOf('c1', 'sheets')).toBe(0)
  })

  it('sair da conta apaga o mapa com o resto da sessão', async () => {
    const { session } = testSession(
      url =>
        url.endsWith('/auth/logout')
          ? new Response(null, { status: 204 })
          : json(200, tokens()),
      memoryStore(true, 'refresh-0')
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider
          session={session}
          purgeHttpCache={async () => undefined}
        >
          {null}
        </SessionProvider>
      </QueryClientProvider>
    )
    await waitFor(() => expect(session.getState().status).toBe('signedIn'))
    rememberScroll('c1', 'table', 480)
    await session.logout()
    expect(scrollOf('c1', 'table')).toBe(0)
  })
})
