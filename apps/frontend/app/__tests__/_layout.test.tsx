import { render } from '@testing-library/react-native'
import type { ComponentType } from 'react'

import Layout from '../_layout'

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
