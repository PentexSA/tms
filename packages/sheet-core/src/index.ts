// @tms/sheet-core: núcleo do motor de ficha (doc/arquitetura-motor-de-ficha.md §5).
// TS puro, sem React, sem I/O e sem APIs de plataforma. A API (Bun) e o app
// (Expo) usam o mesmo código: no servidor ele é a autoridade; no cliente,
// conveniência.

// A condição declarativa da contabilização (`in`, `equalsTarget`,
// `itemIn`): o app diz qual escolha trava um valor inicial (P05-C)
export { conditionHolds } from './accounting'
export * from './alerts'
export * from './classify'
export * from './compile'
export type * from './contract'
export * from './costs'
export * from './creation'
export { DERIVE, isDeriveName } from './derive'
export * from './effects'
export { jsonEqual } from './equal'
export * from './events'
export * from './fields'
export * from './group'
export * from './identity'
export * from './labels'
export * from './modes'
export * from './options'
export * from './order'
export { PALETTE } from './palette'
export * from './parse'
export * from './permissions'
export * from './policy'
export * from './random'
export * from './recoveries'
export * from './registry'
export * from './resolve'
export * from './rollers/pool-success'
export * as clockRules from './rules/clock'
export * as resourceRules from './rules/resource'
export * as stackingRules from './rules/wod-stacking'
export * from './text'
export * from './validate'
