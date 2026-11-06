// Conferência de forma do que vem da rede ou do disco (input hostil).

/** Um objeto simples: nem null nem lista. */
export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
