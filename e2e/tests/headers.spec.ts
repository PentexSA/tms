import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { API_URL, WEB_URL } from '../env'
import { signUp } from '../support/users'

// Etapa 22: os cabeçalhos de segurança da hospedagem do web, gerados por
// scripts/web-headers.mjs em dist/_headers. Os outros specs já rodam sob
// esta CSP: se o bundle precisasse de eval ou de script inline, quebrariam.

test('a página e os assets saem com a CSP e os cabeçalhos de segurança', async ({
  request,
}) => {
  for (const path of ['/', '/characters/qualquer']) {
    const res = await request.get(path)
    const csp = res.headers()['content-security-policy'] ?? ''
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain(`connect-src 'self' ${new URL(API_URL).origin}`)
    expect(res.headers()).toMatchObject({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cross-origin-opener-policy': 'same-origin',
    })
  }
})

test('o _headers é configuração da hospedagem, não é servido', async ({
  request,
}) => {
  const res = await request.get('/_headers')
  expect(await res.text()).not.toContain('Content-Security-Policy')
})

test('o app abre sem violar a CSP', async ({ page }) => {
  const violations: string[] = []
  page.on('console', m => {
    if (/Content Security Policy|CSP/i.test(m.text())) violations.push(m.text())
  })
  await page.goto('/login')
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  expect(violations).toEqual([])
})

// T-13: no aparelho, o NSURLCache (iOS) e o OkHttp (Android) gravavam em
// disco as respostas da API com tokens e dados ocultos. No servidor Bun de
// verdade (não no app.handle dos testes da API), toda resposta pede no-store,
// inclusive o erro de login.
test('a API de verdade responde com no-store', async ({ request }) => {
  const health = await request.get(`${API_URL}/health`)
  const login = await request.post(`${API_URL}/auth/login`, {
    headers: { 'x-tms-client': 'native' },
    data: { email: 'ninguem@example.test', password: 'senha errada e longa' },
  })
  expect(health.status()).toBe(200)
  expect(login.status()).toBe(401)
  for (const res of [health, login])
    expect(res.headers()).toMatchObject({
      'cache-control': 'no-store',
      pragma: 'no-cache',
    })
})

// Fase 2 de observabilidade: no export web, Constants.expoConfig precisa trazer
// a versão do app.json (sem cair no '0' nem na do cache do Metro), e o preflight
// aceitar o header. Um teste por caminho, cada um com o seu navegador: um refresh
// recusado marca a sessão como encerrada, e o app não tenta de novo (T-74).
const ROOT_VERSION = (
  JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as {
    version: string
  }
).version

const watchVersions = (page: Page) => {
  const sent = new Map<string, string | undefined>()
  page.on('request', async request => {
    if (!request.url().startsWith(API_URL)) return
    const { pathname } = new URL(request.url())
    const headers = await request.allHeaders()
    sent.set(`${request.method()} ${pathname}`, headers['x-tms-client-version'])
  })
  return sent
}

test('o POST de sessão manda a versão da raiz', async ({ page }) => {
  const sent = watchVersions(page)
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('ninguem@example.test')
  await page.getByLabel('Senha').fill('qualquer senha errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'E-mail ou senha incorretos'
  )
  await expect.poll(() => sent.get('POST /auth/login')).toBe(ROOT_VERSION)
})

test('o Eden manda a versão da raiz, com a sessão pelo refresh', async ({
  page,
  context,
}) => {
  const sent = watchVersions(page)
  await signUp(context, 'versao')
  await page.goto('/')
  await expect.poll(() => sent.get('GET /chronicles')).toBe(ROOT_VERSION)
  await expect.poll(() => sent.get('POST /auth/refresh')).toBe(ROOT_VERSION)
  for (const [call, value] of sent)
    if (!call.startsWith('OPTIONS')) expect(value, call).toBe(ROOT_VERSION)
})

test('o preflight aceita o header e o navegador lê o x-request-id', async ({
  page,
  request,
}) => {
  const preflight = await request.fetch(`${API_URL}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      origin: WEB_URL,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'x-tms-client-version',
    },
  })
  expect(preflight.status()).toBe(204)
  expect(preflight.headers()['access-control-allow-headers']).toContain(
    'x-tms-client-version'
  )

  // De outra origem, o fetch só enxerga o header exposto pelo CORS
  await page.goto('/login')
  const id = await page.evaluate(
    async url => (await fetch(`${url}/nao-existe`)).headers.get('x-request-id'),
    API_URL
  )
  expect(id).toMatch(/^[0-9a-f-]{36}$/)
})
