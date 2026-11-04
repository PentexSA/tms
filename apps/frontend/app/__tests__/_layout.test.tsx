import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ComponentType } from 'react'

import { captureError } from '../../lib/telemetry'
import Layout, { ErrorBoundary } from '../_layout'

jest.mock('../../lib/telemetry', () => ({
  initTelemetry: jest.fn(),
  captureError: jest.fn(),
}))

/**
 * Layout raiz: providers (safe area, tema, query, sessão, toast) e o Slot do
 * Expo Router.
 */
jest.mock('../../lib/session', () => {
  const actual = jest.requireActual('../../lib/session')
  return {
    ...actual,
    session: new actual.Session({
      apiUrl: 'http://api.test',
      store: {
        refreshInBody: true,
        read: async () => null,
        write: async () => undefined,
        clear: async () => undefined,
        pendingLogout: {
          read: async () => [],
          write: async () => undefined,
        },
      },
      fetch: async () => new Response(null, { status: 401 }),
    }),
  }
})

describe('Layout', () => {
  it('renderiza os providers e o Slot', () => {
    const { UNSAFE_getByType } = render(<Layout />)
    // test/setup.ts mocka o Slot do expo-router como o host component 'Slot'
    expect(UNSAFE_getByType('Slot' as unknown as ComponentType)).toBeTruthy()
  })
})

// Fase 3: o boundary da raiz fica fora dos providers (sem ThemeProvider) e
// avisa o error tracking; a mensagem do erro não aparece
describe('ErrorBoundary da raiz', () => {
  it('fallback sem provider, sem a mensagem do erro, e avisa o telemetry', () => {
    const error = new Error('Helena Varga: força 99')
    const retry = jest.fn(() => Promise.resolve())
    render(<ErrorBoundary error={error} retry={retry} />)
    expect(screen.getByText('Algo deu errado')).toBeTruthy()
    expect(screen.queryByText(/Helena|força/)).toBeNull()
    expect(captureError).toHaveBeenCalledWith(error, { source: 'boundary' })
    fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(retry).toHaveBeenCalled()
  })
})
