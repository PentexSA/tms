// @tms/sheet-core: núcleo do motor de ficha (doc/arquitetura-motor-de-ficha.md §5).
// TS puro, sem React, sem I/O e sem APIs de plataforma. A API (Bun) e o app
// (Expo) usam o mesmo código: no servidor ele é a autoridade; no cliente,
// conveniência.

export * from './compile'
export type * from './contract'
export { DERIVE, isDeriveName } from './derive'
export { PALETTE } from './palette'
export * from './parse'
export * from './registry'
export * from './resolve'
export * from './validate'
