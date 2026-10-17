/**
 * Test helper utilities for Bun tests
 * Common functions for setup, teardown, and test utilities
 */

/**
 * Delays execution for a given number of milliseconds
 * Useful for testing async operations
 */
export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a mock async function that tracks calls
 * Alternative to jest.fn() for simple cases
 */
export function createMockFn<T extends (...args: unknown[]) => unknown>(
  implementation?: T
): T & { calls: unknown[]; reset: () => void } {
  const calls: unknown[] = []

  const fn = ((...args: unknown[]) => {
    calls.push(args)
    return implementation?.(...args)
  }) as T & { calls: unknown[]; reset: () => void }

  fn.calls = calls
  fn.reset = () => {
    calls.length = 0
  }

  return fn
}

/**
 * Setup function for database tests
 * Can be used in beforeAll or beforeEach hooks
 *
 * Example:
 * beforeAll(async () => {
 *   await setupDatabaseTest({ connectionString: 'postgres://localhost/test' });
 * });
 */
export async function setupDatabaseTest(_config?: {
  connectionString?: string
}): Promise<void> {
  // Placeholder for database setup
  // This will be extended in db-specific test helpers
}

/**
 * Teardown function for database tests
 * Can be used in afterAll or afterEach hooks
 */
export async function teardownDatabaseTest(): Promise<void> {
  // Placeholder for database teardown
  // This will be extended in db-specific test helpers
}

/**
 * Create a test matrix for parameterized tests
 * Helps run the same test with different inputs
 *
 * Example:
 * testMatrix('addition', [
 *   { a: 1, b: 2, expected: 3 },
 *   { a: 0, b: 0, expected: 0 },
 * ]);
 */
export function testMatrix<T extends Record<string, unknown>>(
  name: string,
  cases: T[]
): void {
  // This is a placeholder - actual implementation depends on Bun's test.each() support
  console.log(`Test matrix for: ${name} with ${cases.length} cases`)
}
