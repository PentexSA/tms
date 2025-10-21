import z from 'zod'

const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z
    .url()
    .default('postgres://postgres:postgres@localhost:5432/tms'),
  API_PORT: z.coerce.number().default(3001),
  EXPO_PUBLIC_API_URL: z.url().default('http://localhost:3001'),
})

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
export const config = new Proxy({} as z.infer<typeof configSchema>, {
  get(_target, prop: string | symbol) {
    // Always parse fresh to pick up env var changes
    const freshConfig = parseConfig(process.env)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (freshConfig as any)[prop]
  },
}) as z.infer<typeof configSchema>
