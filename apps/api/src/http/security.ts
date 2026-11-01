import { isIP } from 'node:net'
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
  // A API só devolve dado de sessão (tokens, ficha, NPC oculto): nada vai para
  // cache de navegador, de proxy ou do sistema (NSURLCache no iOS, OkHttp no
  // Android), que gravam em disco e em claro. MASVS-STORAGE; ASVS 8.2.1 (T-13)
  'cache-control': 'no-store',
  pragma: 'no-cache',
}

export const securityHeaders = (options: { swagger: boolean }) =>
  // onRequest é sempre global no Elysia
  new Elysia({ name: 'security-headers' }).onRequest(({ request, set }) => {
    for (const [k, v] of Object.entries(HEADERS)) set.headers[k] = v
    // A UI do swagger (só fora de produção) precisa de script e estilo
    if (options.swagger && new URL(request.url).pathname.startsWith('/swagger'))
      delete set.headers['content-security-policy']
  })

/** Header com que o E2E simula clientes distintos (só com TEST_CLIENT_IP). */
export const TEST_CLIENT_IP_HEADER = 'x-tms-test-client-ip'

/** De onde vem o IP do cliente. O AppOptions satisfaz este formato. */
export interface ClientIpPolicy {
  // Atrás de exatamente um proxy reverso, que acrescenta ao fim do
  // X-Forwarded-For o IP de quem se conectou a ele
  readonly trustProxy: boolean
  // Só no E2E: o navegador do Playwright representa clientes distintos sem
  // proxy. O config recusa em produção e junto do TRUST_PROXY
  readonly testClientIp: boolean
}

/** Só um endereço IPv4 ou IPv6 válido, sem espaço, porta ou lixo. */
const validIp = (value: string | undefined) =>
  value && isIP(value) !== 0 ? value : undefined

/**
 * IP do cliente para o rate limit. Com TRUST_PROXY, o último endereço do
 * X-Forwarded-For (o que o nosso proxy acrescentou); sem proxy confiável, o
 * header é ignorado, porque o cliente o forja à vontade. Hop vazio ou
 * inválido cai no IP da conexão: junta clientes no IP do proxy, o que deixa
 * o limite mais estrito, nunca mais frouxo. O valor do header não é logado.
 */
export function clientIp(
  request: Request,
  server: { requestIP(r: Request): { address: string } | null } | null,
  policy: ClientIpPolicy
): string {
  const socket = () => server?.requestIP(request)?.address ?? 'local'
  if (policy.trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for')
    return validIp(forwarded?.split(',').at(-1)?.trim()) ?? socket()
  }
  if (policy.testClientIp)
    return (
      validIp(request.headers.get(TEST_CLIENT_IP_HEADER)?.trim()) ?? socket()
    )
  return socket()
}
