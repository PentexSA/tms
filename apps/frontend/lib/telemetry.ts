// Error tracking do app (Sentry, Fase 3), sem efeito. É o módulo que o nativo,
// o Jest e o tsc resolvem: o bundle nativo não leva o SDK. O web resolve
// telemetry.web.ts, com o mesmo contrato. O nativo fica para a Fase 8
// (telemetry.native.ts). Nada aqui importa @sentry (lib/__tests__/telemetry.test.ts).

import type { CaptureContext } from './telemetryFilter'

export type { CaptureContext }

/** Liga o error tracking. Sem DSN no build, não faz nada. */
export function initTelemetry(): void {
  // sem efeito no nativo
}

/**
 * Envia um erro, se for defeito (lib/errors.ts classifyError). Nunca lança e
 * nunca recebe dado do usuário que o filtro não cubra.
 */
export function captureError(_error: unknown, _context: CaptureContext): void {
  // sem efeito no nativo
}
