import { join, normalize } from 'node:path'
import { file as bunFile, serve } from 'bun'

// Serve o export web do app como a hospedagem de produção: arquivo estático,
// fallback para o index.html (rotas do Expo Router) e a CSP do plano (Etapa
// 22). Se o bundle precisar de eval ou de script inline, o E2E quebra aqui.
const [root = '../apps/frontend/dist', port = '8181', api = ''] =
  process.argv.slice(2)

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // react-native-web injeta <style> com os estilos dos componentes
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' ${api}`,
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ')

const headers = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
}

serve({
  port: Number(port),
  async fetch(request) {
    const path = normalize(decodeURIComponent(new URL(request.url).pathname))
    if (path.includes('..'))
      return new Response('caminho inválido', { status: 400 })
    const file = bunFile(join(root, path))
    if (path !== '/' && (await file.exists()))
      return new Response(file, { headers })
    return new Response(bunFile(join(root, 'index.html')), {
      headers: { ...headers, 'content-type': 'text/html; charset=utf-8' },
    })
  },
})
console.log(`web em http://localhost:${port} (${root})`)
