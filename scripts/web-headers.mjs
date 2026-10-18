#!/usr/bin/env node
// Gera dist/_headers, os cabeçalhos de segurança do app web (Etapa 22), no
// formato das hospedagens estáticas (Netlify, Cloudflare Pages). É a fonte
// única: o servidor do E2E (e2e/serve-web.ts) lê este mesmo arquivo, então o
// E2E roda com a CSP de produção. Se o bundle precisar de eval ou de script
// inline, o E2E quebra.
//
// Uso: node scripts/web-headers.mjs <dist> [url da API]
// Sem o segundo argumento, usa EXPO_PUBLIC_API_URL (a mesma do bundle).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dist, apiArg] = process.argv.slice(2)
const api = apiArg ?? process.env.EXPO_PUBLIC_API_URL
if (!dist || !api) {
  console.error('uso: web-headers.mjs <dist> <url da API>')
  process.exit(2)
}
let origin
try {
  const url = new URL(api)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
  origin = url.origin
} catch {
  console.error(`URL da API inválida: ${api}`)
  process.exit(2)
}

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  // react-native-web injeta <style> com os estilos dos componentes
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${origin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const headers = {
  'Content-Security-Policy': csp,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  // Só vale em HTTPS (o navegador ignora em http://localhost)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

const body = [
  '/*',
  ...Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`),
  '',
].join('\n')
writeFileSync(join(dist, '_headers'), body)
console.log(`_headers ok: connect-src ${origin}`)
