import { createHash } from 'node:crypto'

/**
 * O hash da intenção de um comando idempotente (`chronicle_commands`): o
 * tipo e o pedido. A mesma chave com outro hash é outra intenção (409
 * IDEMPOTENCY_CONFLICT).
 */
export const commandHash = (kind: string, request: unknown): string =>
  createHash('sha256').update(JSON.stringify({ kind, request })).digest('hex')
