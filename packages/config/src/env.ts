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

const parseResult = configSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error(
    '❌ Invalid environment variables:',
    z.prettifyError(parseResult.error)
  )

  process.exit(1)
}

export const config = parseResult.data
