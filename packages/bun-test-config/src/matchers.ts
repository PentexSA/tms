/**
 * Custom matchers for Bun tests
 * Extends Bun's expect() with additional matchers
 */

/**
 * Custom matcher to check if a value is a valid UUID
 *
 * Usage:
 * expect(uuidString).toBeValidUUID();
 */
declare global {
  interface Matchers<R> {
    toBeValidUUID(): R
    toBeValidDate(): R
  }
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Check if a string is a valid UUID v4
 */
export function isValidUUID(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return UUID_REGEX.test(value)
}

/**
 * Check if a string is a valid ISO date
 */
export function isValidDate(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const date = new Date(value)
  return !isNaN(date.getTime())
}
