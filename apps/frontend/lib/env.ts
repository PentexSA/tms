// Configuração do app. O Expo só embute no bundle as variáveis lidas pelo nome
// completo (process.env.EXPO_PUBLIC_...), então nada de ler process.env inteiro
// (o @tms/config é do servidor). Só EXPO_PUBLIC_*: tudo aqui é público.

const DEFAULT_API_URL = 'http://localhost:3001'

export function apiUrlOf(raw: string | undefined): string {
  if (!raw) return DEFAULT_API_URL
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('EXPO_PUBLIC_API_URL precisa ser http(s)')
  return url.origin
}

export const API_URL = apiUrlOf(process.env.EXPO_PUBLIC_API_URL)

/**
 * A origem do web, para o link do convite no app (P12, D-14). Sem a
 * variável, a origem da API: no deploy do Render, a API fica na mesma origem
 * do web (deploy/render/Caddyfile). Em desenvolvimento, o web é a 8081 e a
 * API a 3001: o roteiro exporta EXPO_PUBLIC_WEB_URL.
 */
export function webUrlOf(raw: string | undefined, apiUrl: string): string {
  if (!raw) return new URL(apiUrl).origin
  const url = new URL(raw)
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new Error('EXPO_PUBLIC_WEB_URL precisa ser http(s)')
  return url.origin
}

export const WEB_URL = webUrlOf(process.env.EXPO_PUBLIC_WEB_URL, API_URL)
