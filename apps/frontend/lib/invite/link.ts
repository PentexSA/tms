// O link do convite (D-14, P12): `https://<web>/join#<código>`. O código vai
// só no fragmento, que o navegador não manda ao servidor nem põe no Referer.
// Nada do fragmento vira caminho, rota ou parâmetro: ou é um código no
// formato fechado, ou é ignorado.

import { Platform } from 'react-native'

import { WEB_URL } from '../env'

// O mesmo teto do corpo do aceite (apps/api/src/chronicles/routes.ts); só
// letras, números e hífen. Espaço, "/", "?", "%" e o resto: não é código
const FRAGMENT = /^#([0-9A-Za-z-]{1,64})$/

/** O código do fragmento (`#…`), ou null para qualquer outra coisa. */
export function parseInviteFragment(
  hash: string | null | undefined
): string | null {
  if (!hash) return null
  const match = FRAGMENT.exec(hash)
  return match?.[1] ?? null
}

/** O link que o narrador manda: o código cru, sem os espaços da tela. */
export const inviteLink = (code: string, base: string): string =>
  `${base}/join#${code.replace(/[\s-]/g, '')}`

/** A origem do web: a da página, no web; a do build (EXPO_PUBLIC_WEB_URL), no app. */
export function webOrigin(): string {
  const page = globalThis as { location?: { origin?: string } }
  if (Platform.OS === 'web' && page.location?.origin)
    return page.location.origin
  return WEB_URL
}
