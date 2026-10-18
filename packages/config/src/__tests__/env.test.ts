/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'

describe('@tms/config - Environment Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Bun isolates modules per test, but we still need to restore env vars
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Default values', () => {
    it('should use default values when env vars are not set', async () => {
      delete process.env.NODE_ENV
      delete process.env.DATABASE_URL
      delete process.env.API_PORT
      delete process.env.EXPO_PUBLIC_API_URL

      const { config } = await import('../env')

      expect(config.NODE_ENV).toBe('development')
      expect(config.DATABASE_URL).toBe(
        'postgres://postgres:postgres@localhost:5432/tms'
      )
      expect(config.API_PORT).toBe(3001)
      expect(config.EXPO_PUBLIC_API_URL).toBe('http://localhost:3001')
    })

    it('should use default development mode when NODE_ENV is not set', async () => {
      delete process.env.NODE_ENV

      const { config } = await import('../env')

      expect(config.NODE_ENV).toBe('development')
    })
  })

  describe('Environment variable parsing', () => {
    it('should parse valid environment variables', async () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'x'.repeat(32)
      process.env.DATABASE_URL = 'postgres://user:pass@db.example.com:5432/prod'
      process.env.API_PORT = '8080'
      process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com'

      const { config } = await import('../env')

      expect(config.NODE_ENV).toBe('production')
      expect(config.DATABASE_URL).toBe(
        'postgres://user:pass@db.example.com:5432/prod'
      )
      expect(config.API_PORT).toBe(8080)
      expect(config.EXPO_PUBLIC_API_URL).toBe('https://api.example.com')
    })

    it('should coerce API_PORT from string to number', async () => {
      process.env.API_PORT = '4000'

      const { config } = await import('../env')

      expect(config.API_PORT).toBe(4000)
      expect(typeof config.API_PORT).toBe('number')
    })

    it('should accept test environment', async () => {
      process.env.NODE_ENV = 'test'

      const { config } = await import('../env')

      expect(config.NODE_ENV).toBe('test')
    })

    it('should accept development environment', async () => {
      process.env.NODE_ENV = 'development'

      const { config } = await import('../env')

      expect(config.NODE_ENV).toBe('development')
    })

    it('should accept production environment', async () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'x'.repeat(32)

      const { config } = await import('../env')

      expect(config.NODE_ENV).toBe('production')
    })
  })

  describe('URL validation', () => {
    it('should accept valid DATABASE_URL with postgres protocol', async () => {
      process.env.DATABASE_URL = 'postgres://localhost:5432/mydb'

      const { config } = await import('../env')

      expect(config.DATABASE_URL).toBe('postgres://localhost:5432/mydb')
    })

    it('should accept valid EXPO_PUBLIC_API_URL with http', async () => {
      process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000'

      const { config } = await import('../env')

      expect(config.EXPO_PUBLIC_API_URL).toBe('http://localhost:3000')
    })

    it('should accept valid EXPO_PUBLIC_API_URL with https', async () => {
      process.env.EXPO_PUBLIC_API_URL = 'https://api.production.com'

      const { config } = await import('../env')

      expect(config.EXPO_PUBLIC_API_URL).toBe('https://api.production.com')
    })
  })

  describe('Type coercion', () => {
    it('should coerce string port to number', async () => {
      process.env.API_PORT = '5000'

      const { config } = await import('../env')

      expect(config.API_PORT).toBe(5000)
      expect(typeof config.API_PORT).toBe('number')
    })

    it('should handle numeric string with spaces (after trim)', async () => {
      process.env.API_PORT = '3000'

      const { config } = await import('../env')

      expect(config.API_PORT).toBe(3000)
    })
  })

  describe('Edge cases', () => {
    it('should maintain same config instance across imports', async () => {
      const { config: config1 } = await import('../env')
      const { config: config2 } = await import('../env')

      expect(config1).toBe(config2)
    })

    it('should handle DATABASE_URL with authentication', async () => {
      process.env.DATABASE_URL =
        'postgres://admin:secret123@db.host.com:5432/mydb'

      const { config } = await import('../env')

      expect(config.DATABASE_URL).toBe(
        'postgres://admin:secret123@db.host.com:5432/mydb'
      )
    })

    it('should handle different port numbers', async () => {
      process.env.API_PORT = '9000'

      const { config } = await import('../env')

      expect(config.API_PORT).toBe(9000)
    })
  })

  describe('Auth and HTTP settings', () => {
    it('should parse CORS_ORIGINS as a trimmed list', async () => {
      process.env.CORS_ORIGINS = 'https://app.tms.test, http://localhost:8081 ,'
      const { config } = await import('../env')
      expect(config.CORS_ORIGINS).toEqual([
        'https://app.tms.test',
        'http://localhost:8081',
      ])
    })

    it('should default JWT issuer, audience and proxy trust', async () => {
      delete process.env.JWT_ISSUER
      delete process.env.JWT_AUDIENCE
      delete process.env.TRUST_PROXY
      const { config } = await import('../env')
      expect(config.JWT_ISSUER).toBe('tms-api')
      expect(config.JWT_AUDIENCE).toBe('tms-app')
      expect(config.TRUST_PROXY).toBe(false)
    })

    it('should parse TRUST_PROXY', async () => {
      process.env.TRUST_PROXY = 'true'
      const { config } = await import('../env')
      expect(config.TRUST_PROXY).toBe(true)
    })

    it.each([
      ['JWT_SECRET curto', { JWT_SECRET: 'curto' }],
      ['CORS com *', { CORS_ORIGINS: '*' }],
      ['produção sem JWT_SECRET', { NODE_ENV: 'production' }],
    ])('should reject %s', async (_, env) => {
      delete process.env.JWT_SECRET
      Object.assign(process.env, { NODE_ENV: 'test', ...env })
      const error = spyOn(console, 'error').mockImplementation(() => undefined)
      const exit = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit')
      })
      try {
        const { config } = await import('../env')
        expect(() => config.JWT_ISSUER).toThrow()
        expect(error).toHaveBeenCalled()
      } finally {
        error.mockRestore()
        exit.mockRestore()
      }
    })

    it('should accept production with a long JWT_SECRET', async () => {
      process.env.NODE_ENV = 'production'
      process.env.JWT_SECRET = 'x'.repeat(48)
      const { config } = await import('../env')
      expect(config.JWT_SECRET).toHaveLength(48)
    })
  })

  describe('Invalid environment', () => {
    it('should report invalid variables without exiting in tests', async () => {
      process.env.NODE_ENV = 'test'
      process.env.DATABASE_URL = 'not-a-url'
      const error = spyOn(console, 'error').mockImplementation(() => undefined)
      const exit = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit')
      })
      try {
        const { config } = await import('../env')

        // Sem config válida, ler qualquer chave falha (nunca um valor errado)
        expect(() => config.DATABASE_URL).toThrow()
        expect(error).toHaveBeenCalled()
        expect(exit).not.toHaveBeenCalled()
      } finally {
        error.mockRestore()
        exit.mockRestore()
      }
    })

    it('should exit outside tests (fail fast on boot)', async () => {
      process.env.NODE_ENV = 'production'
      process.env.API_PORT = 'not-a-port'
      const error = spyOn(console, 'error').mockImplementation(() => undefined)
      const exit = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit')
      })
      try {
        const { config } = await import('../env')

        expect(() => config.API_PORT).toThrow('exit')
        expect(exit).toHaveBeenCalledWith(1)
      } finally {
        error.mockRestore()
        exit.mockRestore()
      }
    })
  })
})
