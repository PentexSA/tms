import type { CreationInfo } from './creation'

// O próximo passo da criação, na barra de ação (D-03, P04-D §3.3): uma linha
// que diz o que falta e quem conclui, pelo modo da crônica (livre, por pontos
// com ou sem aprovação) e pelo papel de quem lê. Nenhum nome de sistema; o
// que acontece depois de concluir já está na confirmação (completion.ts).

/** Quem lê: o dono jogador, o narrador na ficha dele ou na de outra pessoa. */
export type NextStepReader = 'owner' | 'storyteller' | 'other'

/** O último passo do ciclo que a ficha guarda. */
export type NextStepMarker = 'adjust' | 'returned' | 'ready' | null

export interface NextStepInput {
  readonly by: NextStepReader
  readonly mode: 'free' | 'points'
  readonly approval: boolean
  readonly marker: NextStepMarker
  // Criação por pontos: a conta fechou (o `check.complete` local, o mesmo
  // que mostra o "Concluir"); o servidor decide de novo ao concluir
  readonly closed?: boolean
}

// Até ~48 caracteres: cabe numa linha a 360 dp (caption)
export const NEXT_STEP_MAX = 48

/** A linha do próximo passo; null quando o estado já diz tudo. */
export function nextStepCopy({
  by,
  mode,
  approval,
  marker,
  closed = false,
}: NextStepInput): string | null {
  // O narrador na ficha de outra pessoa: o estado está no selo e no banner
  if (by === 'other') return null
  // A conta fechou (achado 3 do onda-3 §11): a linha muda junto com o botão
  const done = closed && mode === 'points'
  if (by === 'storyteller')
    return done ? CLOSED_COPY.conclude : 'Você conclui a criação.'
  const asked = marker === 'adjust' || marker === 'returned'
  // O pedido do narrador vem antes da conta
  if (done && !asked) return approval ? CLOSED_COPY.send : CLOSED_COPY.conclude
  if (mode === 'free') {
    if (marker === 'ready') return 'Você avisou. O narrador conclui a criação.'
    return asked
      ? 'Ajuste o pedido do narrador e avise de novo.'
      : 'Quando terminar, avise: o narrador conclui.'
  }
  if (approval)
    return asked
      ? 'Ajuste o pedido do narrador e envie de novo.'
      : 'Quando a conta fechar, envie ao narrador.'
  return asked
    ? 'Ajuste o pedido do narrador e conclua.'
    : 'Você conclui quando a conta fechar.'
}

/** As linhas com a conta fechada (rascunho do time, para revisão). */
export const CLOSED_COPY = {
  conclude: 'A conta fechou: você conclui.',
  send: 'A conta fechou: envie ao narrador.',
  // O anúncio, uma vez, quando a conta fecha na tela; com a aprovação, o
  // jogador envia ao narrador em vez de concluir
  announce: 'A conta fechou. Você pode concluir pela barra.',
  announceSend: 'A conta fechou. Você pode enviar ao narrador pela barra.',
} as const

/** O marcador que vale, na precedência do selo (D-02). */
export function markerOf(info: CreationInfo | null): NextStepMarker {
  if (info?.adjust) return 'adjust'
  if (info?.returned) return 'returned'
  if (info?.ready) return 'ready'
  return null
}

/** Quem lê, pelos papéis na ficha. */
export function readerOf(roles: ReadonlySet<string>): NextStepReader {
  const owner = roles.has('owner')
  if (!roles.has('storyteller')) return owner ? 'owner' : 'other'
  return owner ? 'storyteller' : 'other'
}

/** O que o "Avisar que terminei" diz na confirmação (D-03). */
export const READY_COPY = {
  label: 'Avisar que terminei',
  body: 'O narrador vê na Mesa que você terminou e conclui a criação. Até lá, você ainda pode editar.',
  done: 'Pronto: o narrador foi avisado.',
  stale: 'A ficha mudou desde que você abriu. Confira e avise de novo.',
} as const
