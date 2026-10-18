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
}

export const tokenStore: TokenStore = {
  refreshInBody: false,
  read: async () => null,
  write: async () => undefined,
  clear: async () => undefined,
}
