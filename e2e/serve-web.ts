import { readFileSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { file as bunFile, serve } from 'bun'

// Serve o export web do app como a hospedagem de produção: arquivo estático,
// fallback para o index.html (rotas do Expo Router) e os cabeçalhos de
// dist/_headers, gerados por scripts/web-headers.mjs no build (a CSP da
// Etapa 22). Se o bundle precisar de eval ou de script inline, o E2E quebra.
const [root = '../apps/frontend/dist', port = '8181'] = process.argv.slice(2)

/** A regra "/*" do _headers (formato Netlify/Cloudflare Pages). */
function readHeaders(path: string): Record<string, string> {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    throw new Error(`${path} ausente: rode o build:web (web-headers.mjs)`)
  }
  const headers: Record<string, string> = {}
  let inRule = false
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    if (!line.startsWith(' ')) {
      inRule = line.trim() === '/*'
      continue
    }
    const sep = line.indexOf(':')
    if (inRule && sep > 0)
      headers[line.slice(0, sep).trim().toLowerCase()] = line
        .slice(sep + 1)
        .trim()
  }
  if (!headers['content-security-policy'])
    throw new Error(`${path} sem Content-Security-Policy`)
  return headers
}

const headers = readHeaders(join(root, '_headers'))

serve({
  port: Number(port),
  async fetch(request) {
    const path = normalize(decodeURIComponent(new URL(request.url).pathname))
    if (path.includes('..'))
      return new Response('caminho inválido', { status: 400 })
    // O _headers é configuração da hospedagem, não conteúdo
    const file = path === '/_headers' ? null : bunFile(join(root, path))
    if (file && path !== '/' && (await file.exists()))
      return new Response(file, { headers })
    return new Response(bunFile(join(root, 'index.html')), {
      headers: { ...headers, 'content-type': 'text/html; charset=utf-8' },
    })
  },
})
console.log(`web em http://localhost:${port} (${root})`)
