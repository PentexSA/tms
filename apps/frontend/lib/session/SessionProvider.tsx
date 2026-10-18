import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useSyncExternalStore,
} from 'react'
import type { Session, SessionState } from './session'

const SessionContext = createContext<Session | null>(null)

/** Restaura a sessão ao abrir o app e limpa o cache do usuário ao sair. */
export function SessionProvider({
  session,
  children,
}: {
  readonly session: Session
  readonly children: ReactNode
}) {
  const queryClient = useQueryClient()
  useEffect(() => {
    session.restore()
  }, [session])
  useEffect(
    () => session.onSignOut(() => queryClient.clear()),
    [session, queryClient]
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
