import { Elysia } from 'elysia'
import { unauthorized } from '../http/errors'
import { type TokenConfig, verifyAccessToken } from './tokens'

// Nega por padrão: toda rota exige sessão, menos a allowlist abaixo. Rota nova
// já nasce protegida sem código extra (fail secure).
const PUBLIC = new Set([
  '/health',
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
])

export const isPublicPath = (path: string, swagger: boolean) =>
  PUBLIC.has(path) ||
  (swagger && (path === '/swagger' || path.startsWith('/swagger/')))

export const authGuard = (tokens: TokenConfig, options: { swagger: boolean }) =>
  new Elysia({ name: 'auth-guard' })
    .derive({ as: 'global' }, async ({ headers }) => {
      const header = headers.authorization
      const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
      return {
        userId: token ? await verifyAccessToken(tokens, token) : null,
      }
    })
    .onBeforeHandle({ as: 'global' }, ({ path, userId }) => {
      if (!userId && !isPublicPath(path, options.swagger)) throw unauthorized()
    })

/** O usuário da sessão; a guarda já garantiu que existe nas rotas protegidas. */
export function requireUser(userId: string | null): string {
  if (!userId) throw unauthorized()
  return userId
}
