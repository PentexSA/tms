import { api } from './api'
import { messageOf, statusOf } from './errors'
import type { Session } from './session/session'

// Excluir a própria conta (LGPD art. 18, VI; doc/plano-v0.md, Etapa 22).

export interface BlockingChronicle {
  readonly id: string
  readonly name: string
}

export type DeleteAccountResult =
  | { readonly ok: true }
  | {
      readonly ok: false
      // password: senha errada; blocked: narra crônica com outras pessoas
      readonly kind: 'password' | 'blocked' | 'error'
      readonly message: string
      readonly chronicles: readonly BlockingChronicle[]
    }

const failure = (
  kind: 'password' | 'blocked' | 'error',
  message: string,
  chronicles: readonly BlockingChronicle[] = []
): DeleteAccountResult => ({ ok: false, kind, message, chronicles })

const chroniclesOf = (value: unknown): BlockingChronicle[] => {
  const list = (value as { chronicles?: unknown } | null)?.chronicles
  return Array.isArray(list)
    ? list.filter(
        (c): c is BlockingChronicle =>
          typeof c?.id === 'string' && typeof c?.name === 'string'
      )
    : []
}

/**
 * Pede a exclusão com a senha. O DELETE /me não renova a sessão sozinho (o
 * 401 ali é a resposta à senha, lib/http.ts), então a sessão é renovada antes.
 * No sucesso, sai: o logout apaga token, cache, fila e último usuário do
 * aparelho.
 */
export async function deleteAccount(
  session: Pick<Session, 'refresh' | 'signOut'>,
  password: string
): Promise<DeleteAccountResult> {
  if (!(await session.refresh()))
    return failure(
      'error',
      'Não foi possível confirmar a sua sessão. Verifique a conexão e tente de novo.'
    )
  const res = await api.me.delete({ password })
  if (!res.error) {
    await session.signOut()
    return { ok: true }
  }
  const status = statusOf(res.error)
  if (status === 401) return failure('password', 'Senha incorreta.')
  if (status === 409)
    return failure(
      'blocked',
      messageOf(res.error),
      chroniclesOf(res.error.value)
    )
  return failure(
    'error',
    messageOf(res.error, 'Não foi possível excluir a conta.')
  )
}
