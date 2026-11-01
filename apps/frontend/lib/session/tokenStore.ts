// Onde o refresh token mora. No web, num cookie HttpOnly que o JavaScript não
// lê (a API grava em /auth): aqui não há nada a guardar. O app nativo usa
// tokenStore.native.ts (expo-secure-store); o Metro escolhe pelo sufixo.
// Nunca AsyncStorage nem localStorage.

export interface TokenStore {
  // O nativo recebe o refresh token no corpo; o web, no cookie.
  readonly refreshInBody: boolean
  read(): Promise<string | null>
  write(token: string): Promise<void>
  clear(): Promise<void>
  /**
   * A revogação que ainda não chegou ao servidor (T-14): o refresh token de
   * quem saiu sem rede, numa chave à parte. Só o logout o lê; nunca vai para
   * /auth/refresh. No web não há nada (o cookie fica com o navegador e o
   * marcador de sessão diz que o logout está pendente).
   */
  readonly pendingLogout: {
    read(): Promise<string | null>
    write(token: string): Promise<void>
    clear(): Promise<void>
  }
}

export const tokenStore: TokenStore = {
  refreshInBody: false,
  read: async () => null,
  write: async () => undefined,
  clear: async () => undefined,
  pendingLogout: {
    read: async () => null,
    write: async () => undefined,
    clear: async () => undefined,
  },
}
