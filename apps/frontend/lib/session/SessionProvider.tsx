import { onlineManager, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react'
import { purgeHttpCache as purgeNativeHttpCache } from '../../modules/http-cache'
import { clearChronicleScroll } from '../chronicleScroll'
import type { Session, SessionState } from './session'

const SessionContext = createContext<Session | null>(null)

/** Restaura a sessão ao abrir o app e limpa o cache do usuário ao sair. */
export function SessionProvider({
  session,
  children,
  purgeHttpCache = purgeNativeHttpCache,
}: {
  readonly session: Session
  readonly children: ReactNode
  // O cache HTTP em disco do aparelho (T-13); os testes injetam
  readonly purgeHttpCache?: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  useEffect(() => {
    session.restore()
  }, [session])
  useEffect(
    () =>
      session.onSignOut(() => {
        queryClient.clear()
        // A rolagem guardada de cada crônica (T-39) também é da sessão
        clearChronicleScroll()
      }),
    [session, queryClient]
  )
  // Sair apaga as respostas HTTP gravadas no aparelho (a abertura também
  // apaga, no nativo, antes do JS)
  useEffect(
    () => session.onSignOut(() => purgeHttpCache()),
    [session, purgeHttpCache]
  )
  // A revogação de um logout sem rede vai assim que a rede volta (T-14)
  useEffect(
    () =>
      onlineManager.subscribe(online => {
        if (online) void session.retryPendingLogout()
      }),
    [session]
  )
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionState & { readonly session: Session } {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession precisa de um SessionProvider')
  const state = useSyncExternalStore(session.subscribe, session.getState)
  return { ...state, session }
}
