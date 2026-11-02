import { expect, test } from '@playwright/test'
import { API_URL } from '../env'

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
