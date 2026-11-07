// O link do convite no web (D-14, P12). Roda ao importar, no index.ts, antes
// do expo-router/entry: antes de o roteador ler a URL (o Expo Router poria o
// fragmento em params['#']) e antes do initTelemetry (nenhum breadcrumb nasce
// com o código). Em /join com fragmento, válido ou não, a URL vira "/join"
// com history.replaceState: a barra de endereço, o "voltar" e o "avançar"
// não trazem o código de volta. O código válido fica só na memória
// (pending.ts). Nenhum console.* aqui.

import { parseInviteFragment } from './link'
import { setPendingInvite } from './pending'

const JOIN = /^\/join\/?$/

interface PageLocation {
  readonly pathname: string
  readonly hash: string
}
interface PageHistory {
  readonly state: unknown
  replaceState(data: unknown, unused: string, url?: string | null): void
}

/** Lê o código de /join#…, guarda e tira o fragmento da URL. */
export function captureInvite(location: PageLocation, history: PageHistory) {
  if (!JOIN.test(location.pathname) || !location.hash) return
  const code = parseInviteFragment(location.hash)
  if (code) setPendingInvite(code)
  history.replaceState(history.state, '', '/join')
}

interface PageWindow {
  readonly location: PageLocation
  readonly history: PageHistory
  addEventListener(type: string, listener: () => void): void
}

/**
 * Lê agora e a cada troca de fragmento na mesma página (um link colado numa
 * aba já em /join). O popstate vem antes do hashchange e o roteador o
 * escuta: este ouvinte, registrado antes do roteador, tira o código primeiro.
 */
export function installInviteCapture(page: PageWindow) {
  const run = () => captureInvite(page.location, page.history)
  run()
  page.addEventListener('popstate', run)
  page.addEventListener('hashchange', run)
}

const page = globalThis as Partial<PageWindow>
if (page.location && page.history && page.addEventListener)
  installInviteCapture(page as PageWindow)
