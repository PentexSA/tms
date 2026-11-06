// Deep link no app (P12, D-14): `tms://join#<código>`. O Expo Router chama
// esta função com a URL inteira antes de montar a rota. Em join, o código vai
// para a memória (lib/invite/pending.ts) e a rota é "/join", sem fragmento.
// Em qualquer outra URL, o fragmento sai: um deep link nunca abre outra rota
// com o código, e o roteador nunca recebe params['#']. Síncrona, sem rede e
// sem log. No web, o Expo Router não chama este arquivo (lib/invite/capture.web.ts).

import { parseInviteFragment } from '../lib/invite/link'
import { setPendingInvite } from '../lib/invite/pending'

// Sem `new URL`: o caminho sai por regex, igual no Hermes e no Jest
const ABSOLUTE = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i

/** O caminho de uma URL do app: `tms://join` e `tms:///join` dão "/join". */
function pathOf(url: string): string {
  const match = ABSOLUTE.exec(url)
  if (!match) return url.split('?')[0] ?? ''
  const [, scheme = '', host = '', path = ''] = match
  if (/^https?$/i.test(scheme)) return path || '/'
  // Esquema próprio: o "host" é o primeiro segmento do caminho
  return `/${host}${path}`.replace(/\/{2,}/g, '/')
}

export function redirectSystemPath({
  path,
}: {
  readonly path: string
  readonly initial?: boolean
}): string {
  try {
    const at = path.indexOf('#')
    const base = at === -1 ? path : path.slice(0, at)
    if (pathOf(base).replace(/\/$/, '') === '/join') {
      const code = at === -1 ? null : parseInviteFragment(path.slice(at))
      if (code) setPendingInvite(code)
      return '/join'
    }
    return base
  } catch {
    return '/'
  }
}
