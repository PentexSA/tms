import z from 'zod'

const csv = z.string().transform(s =>
  s
    .split(',')
    .map(x => x.trim())
    .filter(Boolean)
)

const configSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    DATABASE_URL: z
      .url()
      .default('postgres://postgres:postgres@localhost:5432/tms'),
    API_PORT: z.coerce.number().default(3001),
    EXPO_PUBLIC_API_URL: z.url().default('http://localhost:3001'),
    // Segredo do JWT de acesso (HS256). Obrigatório em produção, vindo do
    // Azure Key Vault ou do Google Secret Manager; nunca versionado.
    JWT_SECRET: z.string().min(32).optional(),
    JWT_ISSUER: z.string().min(1).default('tms-api'),
    JWT_AUDIENCE: z.string().min(1).default('tms-app'),
    // Origens do app web aceitas pelo CORS (com credenciais). Nunca "*".
    CORS_ORIGINS: csv.default(['http://localhost:8081']),
    // Atrás de um proxy reverso: o IP do cliente vem do X-Forwarded-For.
    TRUST_PROXY: z
      .enum(['true', 'false'])
      .default('false')
      .transform(v => v === 'true'),
  })
  .superRefine((c, ctx) => {
    if (c.NODE_ENV === 'production' && !c.JWT_SECRET)
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'obrigatório em produção',
      })
    if (c.CORS_ORIGINS.includes('*'))
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'liste as origens; "*" não é aceito',
      })
  })

export type Config = z.infer<typeof configSchema>

function parseConfig(env: NodeJS.ProcessEnv = process.env) {
  const parseResult = configSchema.safeParse(env)

  if (!parseResult.success) {
    console.error(
      '❌ Invalid environment variables:\n',
      z.prettifyError(parseResult.error)
    )

    // Only exit in production, not in tests
    if (env.NODE_ENV !== 'test') {
      process.exit(1)
    }
  }

  return parseResult.data
}

// Lazy getter that re-parses on each access during tests
// For production: ESM caches at module load time
// For tests: Bun isolates each import, so re-parsing picks up env var changes
export const config = new Proxy({} as Config, {
  get(_target, prop: string | symbol) {
    // Always parse fresh to pick up env var changes
    const freshConfig = parseConfig(process.env)
    return (freshConfig as Record<string | symbol, unknown>)[prop]
  },
}) as Config
