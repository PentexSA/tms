import { Elysia } from 'elysia'

// Cabeçalhos de segurança em toda resposta (o helmet.js é do Express; no
// Elysia isto é um hook). A API só devolve JSON: a CSP não libera nada.
const HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-site',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

export const securityHeaders = (options: { swagger: boolean }) =>
  // onRequest é sempre global no Elysia
  new Elysia({ name: 'security-headers' }).onRequest(({ request, set }) => {
    for (const [k, v] of Object.entries(HEADERS)) set.headers[k] = v
    // A UI do swagger (só fora de produção) precisa de script e estilo
    if (options.swagger && new URL(request.url).pathname.startsWith('/swagger'))
      delete set.headers['content-security-policy']
  })

/**
 * IP do cliente para o rate limit. Com TRUST_PROXY, o último endereço do
 * X-Forwarded-For (o que o nosso proxy acrescentou); sem proxy confiável, o
 * header é ignorado, porque o cliente o forja à vontade.
 */
export function clientIp(
  request: Request,
  server: { requestIP(r: Request): { address: string } | null } | null,
  trustProxy: boolean
): string {
  if (trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for')
    const last = forwarded?.split(',').at(-1)?.trim()
    if (last) return last
  }
  return server?.requestIP(request)?.address ?? 'local'
}
