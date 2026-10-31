/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { sleep } from 'bun'
import type { App } from '../index'
import { logger } from '../logger'
import {
  createTestApp,
  destroyTestDb,
  makeRequest,
  useTestDb,
} from '../test/helpers'

// Um PGLite para o arquivo, restaurado a cada createTestContext
useTestDb()

describe('TMS API Tests', () => {
  let app: App

  beforeEach(async () => {
    app = await createTestApp()
  })

  afterEach(async () => {
    await destroyTestDb()
  })

  describe('GET /health', () => {
    it('should return ok: true', async () => {
      const response = await makeRequest(app, 'GET', '/health')

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
    })

    it('should have correct content-type', async () => {
      const response = await makeRequest(app, 'GET', '/health')

      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should return a request id', async () => {
      const response = await makeRequest(app, 'GET', '/health')

      expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe('unknown routes', () => {
    it('should return 404', async () => {
      const response = await makeRequest(app, 'GET', '/todos')

      expect(response.status).toBe(404)
    })
  })

  describe('access log', () => {
    it('never logs headers, request body or response body', async () => {
      const info = spyOn(logger, 'info')
      try {
        await makeRequest(
          app,
          'POST',
          '/health',
          { password: 'senha-secreta' },
          { Authorization: 'Bearer token-secreto', Cookie: 'refresh=cookie' }
        )
        await makeRequest(app, 'GET', '/health')
        // onAfterResponse roda depois da resposta
        await sleep(10)

        const logged = JSON.stringify(info.mock.calls)
        expect(info).toHaveBeenCalled()
        for (const secret of ['senha-secreta', 'token-secreto', 'cookie'])
          expect(logged).not.toContain(secret)
        expect(logged).not.toContain('"ok":true')
      } finally {
        info.mockRestore()
      }
    })
  })
})
