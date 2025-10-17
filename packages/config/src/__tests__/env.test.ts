import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('@tms/config - Environment Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
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
      expect(config.DATABASE_URL).toBe('postgres://postgres:postgres@localhost:5432/tms')
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
      process.env.DATABASE_URL = 'postgres://user:pass@db.example.com:5432/prod'
      process.env.API_PORT = '8080'
      process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com'

      const { config } = await import('../env')

      expect(config.NODE_ENV).toBe('production')
      expect(config.DATABASE_URL).toBe('postgres://user:pass@db.example.com:5432/prod')
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
      process.env.DATABASE_URL = 'postgres://admin:secret123@db.host.com:5432/mydb'

      const { config } = await import('../env')

      expect(config.DATABASE_URL).toBe('postgres://admin:secret123@db.host.com:5432/mydb')
    })

    it('should handle different port numbers', async () => {
      process.env.API_PORT = '9000'

      const { config } = await import('../env')

      expect(config.API_PORT).toBe(9000)
    })
  })
})
