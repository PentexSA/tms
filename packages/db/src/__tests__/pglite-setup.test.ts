/// <reference types="bun-types" />
/**
 * Test to verify PGLite installation and basic functionality
 * This test validates that PGLite can be imported and initialized
 */

import { describe, expect, it } from 'bun:test'

describe('PGLite Setup Verification', () => {
  it('should import PGLite successfully', async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    expect(PGlite).toBeDefined()
  })

  it('should create a PGLite instance', async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const pglite = new PGlite()
    expect(pglite).toBeDefined()
  })

  it('should execute simple SQL query on PGLite', async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    const pglite = new PGlite()

    const result = await pglite.query('SELECT 1 as test')
    expect(result).toBeDefined()
    expect(result.rows).toBeDefined()
    expect(result.rows.length).toBeGreaterThan(0)
    expect(result.rows[0]).toHaveProperty('test', 1)

    await pglite.close()
  })
})
