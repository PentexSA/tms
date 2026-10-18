import {
  createFakeSqlite,
  type FakeSqlite,
} from '../../../test/__mocks__/expoSqlite'
import {
  createEncryptedStorage,
  DB_NAME,
  type EncryptedStorageDeps,
  KEY_NAME,
  type StorageProblem,
} from '../encryptedStorage'

// Etapa 22: o storage nativo em SQLCipher (doc/arquitetura §7.2). A chave é
// aleatória, fica só no SecureStore e nunca aparece em log; o que não abre
// com segurança recomeça vazio ou fica em memória (fail secure).

function setup({
  sqlite = createFakeSqlite(),
  secrets = new Map<string, string>(),
  allowPlaintext = false,
}: {
  sqlite?: FakeSqlite
  secrets?: Map<string, string>
  allowPlaintext?: boolean
} = {}) {
  let seed = 0
  const problems: StorageProblem[] = []
  const secure = {
    broken: { get: false, set: false },
    async get(key: string) {
      if (secure.broken.get) throw new Error('Keychain bloqueado')
      return secrets.get(key) ?? null
    },
    async set(key: string, value: string) {
      if (secure.broken.set) throw new Error('Keystore indisponível')
      secrets.set(key, value)
    },
  }
  const randomBytes = jest.fn((count: number) => {
    seed++
    return Uint8Array.from({ length: count }, (_, i) => (i * 7 + seed) % 256)
  })
  const deps: EncryptedStorageDeps = {
    openDatabase: name => sqlite.openDatabaseAsync(name),
    deleteDatabase: name => sqlite.deleteDatabaseAsync(name),
    secrets: secure,
    randomBytes,
    allowPlaintext,
    report: p => problems.push(p),
  }
  const reopen = () => createEncryptedStorage(deps)
  return {
    storage: reopen(),
    reopen,
    sqlite,
    secrets,
    secure,
    randomBytes,
    problems,
  }
}

const file = (sqlite: FakeSqlite) => sqlite.files.get(DB_NAME)

it('primeira abertura gera a chave (32 bytes) e a guarda no SecureStore', async () => {
  const { storage, secrets, randomBytes, sqlite, problems } = setup()
  await storage.setItem('u:a:cache', 'dados')
  expect(randomBytes).toHaveBeenCalledWith(32)
  expect(secrets.get(KEY_NAME)).toMatch(/^[0-9a-f]{64}$/)
  expect(await storage.getItem('u:a:cache')).toBe('dados')
  // O arquivo ficou com a chave: cifrado
  expect(file(sqlite)?.key).toBe(secrets.get(KEY_NAME))
  expect(problems).toEqual([])
})

it('a segunda abertura (app reiniciado) reutiliza a chave e lê os dados', async () => {
  const first = setup()
  await first.storage.setItem('k', 'v')
  const key = first.secrets.get(KEY_NAME)
  const second = first.reopen()
  expect(await second.getItem('k')).toBe('v')
  expect(first.randomBytes).toHaveBeenCalledTimes(1)
  expect(first.secrets.get(KEY_NAME)).toBe(key)
})

it('chave ausente com banco existente (reinstalação, backup): apaga e recomeça', async () => {
  const first = setup()
  await first.storage.setItem('k', 'antigo')
  first.secrets.delete(KEY_NAME)
  const second = first.reopen()
  expect(await second.getItem('k')).toBeNull()
  await second.setItem('k', 'novo')
  expect(await second.getItem('k')).toBe('novo')
  expect(first.randomBytes).toHaveBeenCalledTimes(2)
})

it('o banco da Etapa 20, sem cifra, é apagado na primeira abertura', async () => {
  const sqlite = createFakeSqlite()
  sqlite.files.set(DB_NAME, {
    key: null,
    table: true,
    rows: new Map([['u:a:cache', 'em texto claro']]),
  })
  const { storage, problems } = setup({ sqlite })
  expect(await storage.getItem('u:a:cache')).toBeNull()
  expect(file(sqlite)?.key).toMatch(/^[0-9a-f]{64}$/)
  // Sem chave, apaga antes de abrir: nem tenta ler o texto claro
  expect(problems).toEqual([])
})

it('chave que não abre o banco: apaga e recomeça com ela', async () => {
  const first = setup()
  await first.storage.setItem('k', 'v')
  first.secrets.set(KEY_NAME, 'f'.repeat(64))
  const second = first.reopen()
  expect(await second.getItem('k')).toBeNull()
  await second.setItem('k', 'de novo')
  expect(await second.getItem('k')).toBe('de novo')
  expect(file(first.sqlite)?.key).toBe('f'.repeat(64))
  expect(first.problems).toEqual(['wrong-key'])
})

it('chave adulterada no SecureStore (não é hex de 32 bytes) é trocada', async () => {
  const secrets = new Map([[KEY_NAME, "abc'; DROP TABLE storage; --"]])
  const { storage, randomBytes } = setup({ secrets })
  await storage.setItem('k', 'v')
  expect(randomBytes).toHaveBeenCalledTimes(1)
  expect(secrets.get(KEY_NAME)).toMatch(/^[0-9a-f]{64}$/)
})

it('SecureStore quebrado na leitura: fica em memória e não mexe no banco', async () => {
  const first = setup()
  await first.storage.setItem('k', 'guardado')
  first.secure.broken.get = true
  const second = first.reopen()
  await second.setItem('k', 'só em memória')
  expect(await second.getItem('k')).toBe('só em memória')
  // O banco ficou intacto para quando o Keychain voltar
  expect(file(first.sqlite)?.rows.get('k')).toBe('guardado')
  expect(first.problems).toEqual(['secure-store'])
  expect(first.sqlite.log).toHaveLength(1)
})

it('SecureStore quebrado na gravação da chave nova: em memória, sem banco', async () => {
  const { storage, secure, sqlite, problems } = setup()
  secure.broken.set = true
  await storage.setItem('k', 'v')
  expect(await storage.getItem('k')).toBe('v')
  expect(sqlite.log).toEqual([])
  expect(file(sqlite)).toBeUndefined()
  expect(problems).toEqual(['secure-store'])
})

it('o PRAGMA key vem antes de qualquer outra instrução', async () => {
  const { storage, sqlite, secrets } = setup()
  await storage.keys('u:')
  const [statements] = sqlite.log
  expect(statements?.[0]).toBe(`PRAGMA key = "x'${secrets.get(KEY_NAME)}'";`)
  expect(statements?.slice(1, 3)).toEqual([
    'PRAGMA cipher_version;',
    'SELECT count(*) AS n FROM sqlite_master;',
  ])
})

it('sem SQLCipher no binário: em produção fica em memória; em dev abre', async () => {
  const sqlite = createFakeSqlite()
  sqlite.cipher = false
  const prod = setup({ sqlite })
  await prod.storage.setItem('k', 'v')
  expect(prod.problems).toEqual(['no-sqlcipher'])
  expect(file(sqlite)?.rows.size ?? 0).toBe(0)

  const dev = setup({ sqlite: createFakeSqlite(), allowPlaintext: true })
  dev.sqlite.cipher = false
  await dev.storage.setItem('k', 'v')
  expect(file(dev.sqlite)?.rows.get('k')).toBe('v')
  expect(dev.problems).toEqual([])
})

it('banco que não abre nem depois de recriado: em memória', async () => {
  const { storage, sqlite, problems } = setup()
  sqlite.openDatabaseAsync = async () => {
    throw new Error('disco cheio')
  }
  await storage.setItem('k', 'v')
  expect(await storage.getItem('k')).toBe('v')
  expect(problems).toEqual(['wrong-key', 'sqlite'])
})

it('abre uma vez só, mesmo com chamadas em paralelo', async () => {
  const { storage, randomBytes, sqlite } = setup()
  await Promise.all([
    storage.setItem('a', '1'),
    storage.setItem('b', '2'),
    storage.getItem('a'),
    storage.keys(''),
  ])
  expect(randomBytes).toHaveBeenCalledTimes(1)
  expect(sqlite.log).toHaveLength(1)
})

it('keys por prefixo exato: % e _ não são curinga', async () => {
  const { storage } = setup()
  await storage.setItem('u:a_1:x', '1')
  await storage.setItem('u:ab1:x', '2')
  await storage.setItem('u:%:x', '3')
  expect(await storage.keys('u:a_1:')).toEqual(['u:a_1:x'])
  expect(await storage.keys('u:%')).toEqual(['u:%:x'])
  await storage.removeItem('u:a_1:x')
  expect(await storage.getItem('u:a_1:x')).toBeNull()
})

it('a chave nunca aparece em log', async () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m =>
    jest.spyOn(console, m).mockImplementation(() => undefined)
  )
  try {
    const first = setup()
    await first.storage.setItem('k', 'v')
    const key = first.secrets.get(KEY_NAME) as string
    // Os caminhos que reportam problema
    first.secrets.set(KEY_NAME, 'e'.repeat(64))
    await first.reopen().getItem('k')
    first.secure.broken.get = true
    await first.reopen().getItem('k')
    const logged = JSON.stringify([
      ...spies.flatMap(s => s.mock.calls),
      first.problems,
    ])
    expect(logged).not.toContain(key)
    expect(logged).not.toContain('e'.repeat(64))
    // E nem vai para o banco: só no SecureStore
    expect(JSON.stringify([...(file(first.sqlite)?.rows ?? [])])).not.toContain(
      key
    )
  } finally {
    for (const s of spies) s.mockRestore()
  }
})
