import { scopeStorage } from '../../sheet/sync/kv'
import { deviceStorage } from '../../sheet/sync/storage'
import { API_URL } from '../env'
import { fetchWithTimeout } from '../http'
import { createLastUserStore } from './lastUser'
import { Session } from './session'
import { createSessionChannel, createSessionMarker } from './sessionMarker'
import { tokenStore } from './tokenStore'

export * from './session'

// O web guarda o refresh num cookie HttpOnly: o marcador de sessão e o aviso
// entre abas só existem lá (T-14, T-74). O nativo guarda a revogação
// pendente no keychain (tokenStore.native.ts).
const web = !tokenStore.refreshInBody

// A sessão do app (uma por processo). Os testes criam a sua com deps falsas.
export const session = new Session({
  apiUrl: API_URL,
  store: tokenStore,
  fetch: fetchWithTimeout,
  lastUser: createLastUserStore(deviceStorage),
  marker: web ? createSessionMarker(deviceStorage) : undefined,
  channel: web ? createSessionChannel() : undefined,
  purgeUserData: userId => scopeStorage(deviceStorage, userId).clear(),
})
