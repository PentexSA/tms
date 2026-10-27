// Prepara o "Roteiro de teste — v3, v4 e v5" contra uma API já rodando:
//   bun scripts/seed-roteiro.ts            (API em http://localhost:3001)
//   SEED_API_URL=https://... bun scripts/seed-roteiro.ts
//
// Cria (ou reaproveita) as contas N, J1, J2 e N2, apaga as crônicas que essas
// contas narram (só existem para o roteiro; --keep pula isso) e cria um
// conjunto novo: uma de v3/v5 (criação livre) e uma de v4 (por pontos) por
// sistema, com J1 e J2 já dentro,
// e uma de Vampiro com 21 fichas para o limite de 20 da Mesa (V3-10). N2 não
// entra: recebe um convite para usar no V5-22. J1 e J2 não ganham ficha,
// porque o roteiro começa com eles criando as deles.

const API = (process.env.SEED_API_URL ?? 'http://localhost:3001').replace(
  /\/$/,
  ''
)
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

type Key = (typeof ACCOUNTS)[number]['key']
interface Session {
  key: Key
  username: string
  email: string
  token: string
  ip: string
}

// Um IP simulado por conta (a API do dev roda com TRUST_PROXY=true atrás do
// ngrok), para não dividir o rate limit de cadastro e de convites
const ipFor = (i: number) => `10.77.0.${i + 10}`

async function call<T>(
  method: string,
  path: string,
  opts: { token?: string; ip?: string; body?: unknown } = {}
): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      // O cliente nativo recebe o refresh no corpo, sem cookie
      'x-tms-client': 'native',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.ip ? { 'x-forwarded-for': opts.ip } : {}),
    },
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  })
  const text = await res.text()
  return { status: res.status, data: (text ? JSON.parse(text) : null) as T }
}

async function must<T>(
  method: string,
  path: string,
  opts: { token?: string; ip?: string; body?: unknown } = {}
): Promise<T> {
  const r = await call<T>(method, path, opts)
  if (r.status === 429)
    throw new Error(
      `${method} ${path}: rate limit (os aceites de convite são 10 a cada 15 min por conta). Reinicie a API para zerar, ou espere.`
    )
  if (r.status >= 300)
    throw new Error(`${method} ${path}: ${r.status} ${JSON.stringify(r.data)}`)
  return r.data
}

// Cadastra ou entra. Uma conta excluída (V5-27) não entra mais e o e-mail
// continua tomado: passa para a variante seguinte (roteiro_narrador_2, ...)
async function signIn(i: number): Promise<Session> {
  const a = ACCOUNTS[i]
  const ip = ipFor(i)
  for (let v = 1; v <= 9; v++) {
    const username = v === 1 ? a.username : `${a.username}_${v}`
    const email = `${username}@roteiro.test`
    const reg = await call<{ accessToken: string }>('POST', '/auth/register', {
      ip,
      body: { email, username, password: PASSWORD },
    })
    if (reg.status === 201)
      return { key: a.key, username, email, token: reg.data.accessToken, ip }
    if (reg.status !== 409)
      throw new Error(
        `cadastro de ${a.key}: ${reg.status} ${JSON.stringify(reg.data)}`
      )
    const login = await call<{ accessToken: string }>('POST', '/auth/login', {
      ip,
      body: { email, password: PASSWORD },
    })
    if (login.status === 200)
      return { key: a.key, username, email, token: login.data.accessToken, ip }
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
    'GET',
    '/chronicles',
    { token: s.token, ip: s.ip }
  )
  let n = 0
  for (const c of mine.filter(c => c.role === 'storyteller')) {
    await must('DELETE', `/chronicles/${c.id}`, {
      token: s.token,
      ip: s.ip,
      body: { confirm: c.name },
    })
    n++
  }
  return n
}

async function createChronicle(n: Session, name: string, systemCode: string) {
  return must<{ id: string; name: string }>('POST', '/chronicles', {
    token: n.token,
    ip: n.ip,
    body: { name, systemCode },
  })
}

async function invite(n: Session, chronicleId: string, maxUses = 10) {
  return must<{ code: string; expiresAt: string }>(
    'POST',
    `/chronicles/${chronicleId}/invites`,
    { token: n.token, ip: n.ip, body: { maxUses, expiresInDays: 30 } }
  )
}

async function freeCreation(n: Session, chronicleId: string) {
  await must('PATCH', `/chronicles/${chronicleId}/creation-settings`, {
    token: n.token,
    ip: n.ip,
    body: { revision: 0, defaults: { mode: 'free' } },
  })
}

async function join(user: Session, code: string) {
  await must('POST', '/invites/accept', {
    token: user.token,
    ip: user.ip,
    body: { code },
  })
}

async function main() {
  const health = await fetch(`${API}/swagger`).catch(() => null)
  if (!health) throw new Error(`API fora do ar em ${API}`)

  const sessions: Session[] = []
  for (let i = 0; i < ACCOUNTS.length; i++) sessions.push(await signIn(i))
  const by = (k: Key) => sessions.find(s => s.key === k) as Session
  const N = by('N')

  if (!process.argv.includes('--keep')) {
    let wiped = 0
    for (const s of sessions) wiped += await wipe(s)
    if (wiped) console.log(`Apagadas ${wiped} crônicas da rodada anterior.`)
  }

  const systems = await must<{ code: string }[]>('GET', '/systems', {
    token: N.token,
    ip: N.ip,
  })
  const missing = SYSTEMS.filter(s => !systems.some(x => x.code === s.code))
  if (missing.length)
    throw new Error(
      `sem template publicado: ${missing.map(s => s.code).join(', ')} (rode pnpm templates:publish --published)`
    )

  // Hora local (sv-SE = AAAA-MM-DD HH:MM:SS), não UTC
  const tag = new Date().toLocaleString('sv-SE').slice(5, 16)
  const rows: { name: string; use: string; n2Invite?: string }[] = []

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
    await must('POST', `/chronicles/${crowd.id}/characters`, {
      token: owner.token,
      ip: owner.ip,
      body: { values: { name: `Figurante ${String(i).padStart(2, '0')}` } },
    })
  }
  rows.push({ name: crowd.name, use: 'V3-10 (21 fichas)' })

  console.log(`\nAPI: ${API}\nSenha de todas as contas: ${PASSWORD}\n`)
  console.log('Conta | Papel             | E-mail')
  for (const a of ACCOUNTS)
    console.log(
      `${a.key.padEnd(5)} | ${a.role.padEnd(17)} | ${by(a.key).email}`
    )
  console.log('\nCrônicas (narrador: N; J1 e J2 já são membros):')
  for (const r of rows)
    console.log(
      `- ${r.name}  [${r.use}]${r.n2Invite ? `  convite N2: ${r.n2Invite}` : ''}`
    )
  console.log()
}

main().catch(e => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
