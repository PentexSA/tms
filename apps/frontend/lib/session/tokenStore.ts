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
   * As revogações que ainda não chegaram ao servidor (T-14): os refresh
   * tokens de quem saiu sem rede, numa chave à parte, em lista (sair de B
   * não apaga a pendência de A). Só o logout as lê; nunca vão para
   * /auth/refresh. Lista vazia apaga a chave. No web não há nada (o cookie
   * fica com o navegador e o marcador de sessão diz que o logout está
   * pendente).
   */
  readonly pendingLogout: {
    read(): Promise<readonly string[]>
    write(tokens: readonly string[]): Promise<void>
  }
}

export const tokenStore: TokenStore = {
  refreshInBody: false,
  read: async () => null,
  write: async () => undefined,
  clear: async () => undefined,
  pendingLogout: {
    read: async () => [],
    write: async () => undefined,
  },
}
