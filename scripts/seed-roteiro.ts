// Prepara o "Roteiro de teste — v3, v4 e v5":
//   pnpm seed:roteiro                       (API em processo, no DATABASE_URL)
//   SEED_API_URL=https://... pnpm seed:roteiro   (API remota, por HTTP)
//
// Cria (ou reaproveita) as contas N, J1, J2 e N2, apaga as crônicas que essas
// contas narram (só existem para o roteiro; --keep pula isso) e cria um
// conjunto novo: uma de v3/v5 (criação livre) e uma de v4 (por pontos) por
// sistema, com J1 e J2 já dentro,
// e uma de Vampiro com 21 fichas para o limite de 20 da Mesa (V3-10). N2 não
// entra: recebe um convite para usar no V5-22. J1 e J2 não ganham ficha,
// porque o roteiro começa com eles criando as deles.
//
// S-04: por padrão o seed não precisa da API no ar nem de TRUST_PROXY. Ele
// monta a API em processo (createApp, a mesma dos testes), uma instância por
// conta: cada uma tem o próprio rate limiter em memória com os limites
// padrão, então nenhum limite muda e o seed não depende do IP do cliente.
// Precisa só do banco migrado (as migrations já gravam os templates do
// produto).
import { createRequire } from 'node:module'
import { join } from 'node:path'

const PASSWORD = 'roteiro de teste tms'

const SYSTEMS = [
  { code: 'vtm-v20', label: 'Vampiro' },
  { code: 'mta-m20', label: 'Mago' },
  { code: 'wta-w20', label: 'Lobisomem' },
] as const

const ACCOUNTS = [
  { key: 'N', username: 'roteiro_narrador', role: 'Narrador' },
  { key: 'J1', username: 'roteiro_jogador1', role: 'Jogador 1' },
  { key: 'J2', username: 'roteiro_jogador2', role: 'Jogador 2' },
  { key: 'N2', username: 'roteiro_narrador2', role: 'Segundo narrador' },
] as const

export type Key = (typeof ACCOUNTS)[number]['key']

/** Atende uma requisição: `app.handle` em processo, `fetch` por HTTP. */
export type Handle = (request: Request) => Promise<Response>

export interface SeedOptions {
  /** A API de cada conta (em processo, uma instância por conta). */
  api: (key: Key) => Handle
  /** URL base das requisições. */
  base: string
  /** Não apaga as crônicas da rodada anterior. */
  keep?: boolean
  /** Hora local usada no nome das crônicas. */
  now?: () => Date
}

export interface SeedResult {
  accounts: { key: Key; role: string; email: string }[]
  chronicles: { name: string; use: string; n2Invite?: string }[]
}

interface Session {
  key: Key
  username: string
  email: string
  token: string
}

export async function runSeed(o: SeedOptions): Promise<SeedResult> {
  const base = o.base.replace(/\/$/, '')

  async function call<T>(
    key: Key,
    method: string,
    path: string,
    opts: { token?: string; body?: unknown } = {}
  ): Promise<{ status: number; data: T }> {
    const res = await o.api(key)(
      new Request(`${base}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          // O cliente nativo recebe o refresh no corpo, sem cookie
          'x-tms-client': 'native',
          ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        },
        ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
      })
    )
    const text = await res.text()
    return { status: res.status, data: (text ? JSON.parse(text) : null) as T }
  }

  async function must<T>(
    s: Session,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const r = await call<T>(s.key, method, path, { token: s.token, body })
    if (r.status === 429)
      throw new Error(
        `${method} ${path}: rate limit (os aceites de convite são 10 a cada 15 min por conta e por IP). Rode o seed de novo daqui a 15 min.`
      )
    if (r.status >= 300)
      throw new Error(
        `${method} ${path}: ${r.status} ${JSON.stringify(r.data)}`
      )
    return r.data
  }

  // Cadastra ou entra. Uma conta excluída (V5-27) não entra mais e o e-mail
  // continua tomado: passa para a variante seguinte (roteiro_narrador_2, ...)
  async function signIn(i: number): Promise<Session> {
    const a = ACCOUNTS[i] as (typeof ACCOUNTS)[number]
    for (let v = 1; v <= 9; v++) {
      const username = v === 1 ? a.username : `${a.username}_${v}`
      const email = `${username}@roteiro.test`
      const reg = await call<{ accessToken: string }>(
        a.key,
        'POST',
        '/auth/register',
        { body: { email, username, password: PASSWORD } }
      )
      if (reg.status === 201)
        return { key: a.key, username, email, token: reg.data.accessToken }
      if (reg.status !== 409)
        throw new Error(
          `cadastro de ${a.key}: ${reg.status} ${JSON.stringify(reg.data)}`
        )
      const login = await call<{ accessToken: string }>(
        a.key,
        'POST',
        '/auth/login',
        { body: { email, password: PASSWORD } }
      )
      if (login.status === 200)
        return { key: a.key, username, email, token: login.data.accessToken }
      if (login.status !== 401)
        throw new Error(
          `login de ${a.key}: ${login.status} ${JSON.stringify(login.data)}`
        )
    }
    throw new Error(`nenhuma variante livre para ${a.username}`)
  }

  // Apaga as crônicas que a conta narra, com as fichas de todos
  async function wipe(s: Session) {
    const mine = await must<{ id: string; name: string; role: string }[]>(
      s,
      'GET',
      '/chronicles'
    )
    let n = 0
    for (const c of mine.filter(c => c.role === 'storyteller')) {
      await must(s, 'DELETE', `/chronicles/${c.id}`, { confirm: c.name })
      n++
    }
    return n
  }

  const createChronicle = (n: Session, name: string, systemCode: string) =>
    must<{ id: string; name: string }>(n, 'POST', '/chronicles', {
      name,
      systemCode,
    })

  const invite = (n: Session, chronicleId: string, maxUses = 10) =>
    must<{ code: string; expiresAt: string }>(
      n,
      'POST',
      `/chronicles/${chronicleId}/invites`,
      { maxUses, expiresInDays: 30 }
    )

  const freeCreation = (n: Session, chronicleId: string) =>
    must(n, 'PATCH', `/chronicles/${chronicleId}/creation-settings`, {
      revision: 0,
      defaults: { mode: 'free' },
    })

  const join = (user: Session, code: string) =>
    must(user, 'POST', '/invites/accept', { code })

  const sessions: Session[] = []
  for (let i = 0; i < ACCOUNTS.length; i++) sessions.push(await signIn(i))
  const by = (k: Key) => sessions.find(s => s.key === k) as Session
  const N = by('N')

  if (!o.keep) {
    let wiped = 0
    for (const s of sessions) wiped += await wipe(s)
    if (wiped) console.log(`Apagadas ${wiped} crônicas da rodada anterior.`)
  }

  const systems = await must<{ code: string }[]>(N, 'GET', '/systems')
  const missing = SYSTEMS.filter(s => !systems.some(x => x.code === s.code))
  if (missing.length)
    throw new Error(
      `sem template publicado: ${missing.map(s => s.code).join(', ')} (rode pnpm db:migrate e pnpm templates:publish --published)`
    )

  // Hora local (sv-SE = AAAA-MM-DD HH:MM:SS), não UTC
  const tag = (o.now ?? (() => new Date()))()
    .toLocaleString('sv-SE')
    .slice(5, 16)
  const rows: SeedResult['chronicles'] = []

  for (const s of SYSTEMS) {
    for (const use of ['v3/v5', 'v4'] as const) {
      const c = await createChronicle(N, `${s.label} ${use} · ${tag}`, s.code)
      // A v3 e a v5 não tratam da conta por pontos: criação livre, e o
      // narrador conclui. A v4 fica no padrão do template, por pontos
      if (use === 'v3/v5') await freeCreation(N, c.id)
      const inv = await invite(N, c.id)
      await join(by('J1'), inv.code)
      await join(by('J2'), inv.code)
      // N2 só entra no V5-22; o convite aceita mais de um uso para o V5-24
      // (N2 sai e volta antes da proposta válida do V5-25)
      const n2 = use === 'v3/v5' ? (await invite(N, c.id, 5)).code : undefined
      rows.push({ name: c.name, use, n2Invite: n2 })
    }
  }

  // V3-10: 21 fichas na Mesa, numa crônica separada para não poluir a de
  // Vampiro do roteiro. Cada pessoa tem no máximo 20 fichas por crônica: são
  // 20 PCs do narrador e o 21º do J1
  const crowd = await createChronicle(
    N,
    `Vampiro limite 20 · ${tag}`,
    'vtm-v20'
  )
  await freeCreation(N, crowd.id)
  await join(by('J1'), (await invite(N, crowd.id, 1)).code)
  for (let i = 1; i <= 21; i++) {
    const owner = i === 21 ? by('J1') : N
    await must(owner, 'POST', `/chronicles/${crowd.id}/characters`, {
      values: { name: `Figurante ${String(i).padStart(2, '0')}` },
    })
  }
  rows.push({ name: crowd.name, use: 'V3-10 (21 fichas)' })

  return {
    accounts: ACCOUNTS.map(a => ({
      key: a.key,
      role: a.role,
      email: by(a.key).email,
    })),
    chronicles: rows,
  }
}

// Um IP simulado por conta, para não dividir o rate limit de cadastro e de
// convites. Só vale se o proxy na frente da API repassar o cabeçalho do
// cliente (TRUST_PROXY=true nela); sem isso, todas as contas dividem o IP
function httpApi(key: Key): Handle {
  const ip = `10.77.0.${ACCOUNTS.findIndex(a => a.key === key) + 10}`
  return request => {
    request.headers.set('x-forwarded-for', ip)
    return fetch(request)
  }
}

async function main() {
  const remote = process.env.SEED_API_URL
  let close = () => Promise.resolve()
  let api: (key: Key) => Handle
  let base: string
  if (remote) {
    base = remote
    const health = await fetch(`${remote.replace(/\/$/, '')}/swagger`).catch(
      () => null
    )
    if (!health) throw new Error(`API fora do ar em ${remote}`)
    api = httpApi
  } else {
    // O mesmo @tms/db que a API resolve (o dist, conferido pela checagem
    // do ambiente antes do seed), para fechar o pool no fim
    const fromApi = createRequire(join(import.meta.dir, '../apps/api/x.js'))
    const { db } = (await import(
      fromApi.resolve('@tms/db')
    )) as typeof import('@tms/db')
    const { createApp } = await import('../apps/api/src/index')
    const apps = new Map<Key, Handle>()
    api = key => {
      let handle = apps.get(key)
      if (!handle) {
        const app = createApp(db)
        handle = request => app.handle(request)
        apps.set(key, handle)
      }
      return handle
    }
    base = 'http://localhost'
    close = () => db.destroy()
  }

  try {
    const result = await runSeed({
      api,
      base,
      keep: process.argv.includes('--keep'),
    })
    console.log(
      `\nAPI: ${remote ?? 'em processo'}\nSenha de todas as contas: ${PASSWORD}\n`
    )
    console.log('Conta | Papel             | E-mail')
    for (const a of result.accounts)
      console.log(`${a.key.padEnd(5)} | ${a.role.padEnd(17)} | ${a.email}`)
    console.log('\nCrônicas (narrador: N; J1 e J2 já são membros):')
    for (const r of result.chronicles)
      console.log(
        `- ${r.name}  [${r.use}]${r.n2Invite ? `  convite N2: ${r.n2Invite}` : ''}`
      )
    console.log()
  } finally {
    await close()
  }
}

if (import.meta.main)
  main().catch(e => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
