import { API_URL } from '../env'
import { fetchWithTimeout } from '../http'
import { Session } from './session'
import { tokenStore } from './tokenStore'

export * from './session'

// A sessão do app (uma por processo). Os testes criam a sua com deps falsas.
export const session = new Session({
  apiUrl: API_URL,
  store: tokenStore,
  fetch: fetchWithTimeout,
})
