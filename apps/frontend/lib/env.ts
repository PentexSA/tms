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
