import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { captureError, initTelemetry } from '../telemetry'

// O módulo que o nativo, o Jest e o tsc resolvem não tem efeito e não leva o
// SDK: o build nativo não muda na Fase 3.
describe('telemetry.ts (sem efeito)', () => {
  it('não importa @sentry, nem pelo filtro', () => {
    for (const file of ['telemetry.ts', 'telemetryFilter.ts', 'errors.ts'])
      expect(readFileSync(join(__dirname, '..', file), 'utf8')).not.toMatch(
        /from ['"]@sentry|require\(['"]@sentry/
      )
  })

  it('só telemetry.web.ts importa o SDK', () => {
    expect(
      readFileSync(join(__dirname, '..', 'telemetry.web.ts'), 'utf8')
    ).toMatch(/from '@sentry\/react'/)
  })

  it('init e captura não fazem nada nem lançam', () => {
    expect(() => {
      initTelemetry()
      captureError(new Error('x'), { source: 'boundary' })
    }).not.toThrow()
  })
})
