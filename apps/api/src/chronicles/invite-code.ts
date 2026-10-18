import { createHash } from 'node:crypto'

// Código de convite: 128 bits aleatórios em base32 Crockford (sem I, L, O e
// U, que confundem), 26 caracteres. Mostrado uma vez; o banco guarda o hash.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export function newInviteCode(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

/** Aceita o código como a pessoa digitou: caixa, espaços, hífens e O/I/L. */
export function normalizeInviteCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

export const hashInviteCode = (code: string) =>
  createHash('sha256').update(normalizeInviteCode(code)).digest('hex')
