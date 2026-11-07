// As mensagens de cadastro, login e convite pela situação (o status HTTP),
// não pelo texto da API (T-73, P12). Continuam genéricas contra enumeração:
// cada frase vale para todos os casos que a API já iguala (e-mail inexistente
// e senha errada; e-mail ou nome já usados; convite inexistente, revogado,
// expirado ou esgotado), e nenhuma diz mais do que o status já diz. Texto do
// time, revisável. A API não muda.

import { messageOf, requestIdOf, statusOf, withErrorCode } from './errors'

export type AuthScreen = 'login' | 'register' | 'join'

export const TOO_MANY =
  'Muitas tentativas. Espere alguns minutos e tente de novo.'
export const SERVER_ERROR = 'Algo deu errado do nosso lado. Tente de novo.'

const BY_STATUS: Record<AuthScreen, Partial<Record<number, string>>> = {
  login: {
    400: 'Confira o e-mail e a senha.',
    401: 'E-mail ou senha incorretos. Confira e tente de novo.',
  },
  register: {
    400: 'Confira o e-mail, o nome de usuário e a senha.',
    409: 'Não foi possível criar a conta com esses dados. Se você já tem conta, entre com ela; se não, tente outro nome de usuário.',
  },
  join: {
    400: 'Confira o código: ele tem letras e números.',
    404: 'Este convite não vale mais ou o código está errado. Confira o código ou peça um novo ao narrador.',
  },
}

/**
 * A frase da tela para um status. `raw` é o texto que a sessão ou o Eden
 * já montou (sem resposta, o aviso de conexão), usado quando o status não
 * tem frase própria. Num 5xx, o código do erro sai do `requestId`.
 */
export function authMessage(
  screen: AuthScreen,
  status: number | undefined,
  raw: string,
  requestId?: string
): string {
  // Sem resposta: o aviso de conexão de sempre
  if (!status) return raw
  if (status === 429) return TOO_MANY
  if (status >= 500) return withErrorCode(SERVER_ERROR, status, { requestId })
  return BY_STATUS[screen][status] ?? raw
}

/** Para o erro do Eden (o aceite do convite), com o código do 5xx. */
export function edenAuthMessage(
  screen: AuthScreen,
  error: unknown,
  fallback: string
): string {
  const status = statusOf(error)
  if (status !== undefined && status >= 500) {
    const value = (error as { value?: unknown }).value
    return authMessage(screen, status, '', requestIdOf(value))
  }
  return authMessage(screen, status, messageOf(error, fallback))
}
