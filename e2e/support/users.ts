import { randomUUID } from 'node:crypto'
import type { BrowserContext } from '@playwright/test'
import { API_URL, WEB_URL } from '../env'

// Cadastro direto na API, com o cookie do refresh no contexto do navegador:
// o app abre já com a sessão (é o mesmo caminho do recarregar). Cada cadastro
// vem de um "cliente" diferente (X-Forwarded-For, com TRUST_PROXY na API do
// E2E), para não esbarrar no rate limit de cadastro por IP, que continua ativo.
let seq = 0
const fakeIp = () =>
  `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${(seq % 250) + 1}`

export async function signUp(context: BrowserContext, prefix: string) {
  const id = `${Date.now().toString(36)}${++seq}`
  const username = `${prefix}_${id}`.slice(0, 24)
  const res = await context.request.post(`${API_URL}/auth/register`, {
    data: {
      email: `${username}@example.test`,
      username,
      password: 'correct horse battery staple',
    },
    headers: { origin: WEB_URL, 'x-forwarded-for': fakeIp() },
  })
  if (res.status() !== 201)
    throw new Error(`cadastro falhou: ${res.status()} ${await res.text()}`)
  const { accessToken } = (await res.json()) as { accessToken: string }
  return { username, accessToken }
}

/** Chamada à API como o usuário (token de acesso do cadastro). */
export async function apiAs<T>(
  context: BrowserContext,
  user: { accessToken: string },
  method: 'GET' | 'POST',
  path: string,
  data?: unknown
): Promise<T> {
  const res = await context.request.fetch(`${API_URL}${path}`, {
    method,
    data,
    headers: { authorization: `Bearer ${user.accessToken}` },
  })
  if (!res.ok())
    throw new Error(`${method} ${path}: ${res.status()} ${await res.text()}`)
  return (await res.json()) as T
}

/**
 * A 8ª geração (Sangue 15): o antecedente Geração com 5 pontos. A criação só
 * aceita a identidade, então vai por lote, como no Editar do app.
 */
export function eighthGeneration(
  context: BrowserContext,
  user: { accessToken: string },
  characterId: string
) {
  return apiAs(context, user, 'POST', `/characters/${characterId}/events`, {
    clientBatchId: randomUUID(),
    events: [
      {
        path: 'values.backgrounds',
        from: null,
        to: [{ id: 'b1', name: 'Geração', value: 5 }],
      },
    ],
  })
}
