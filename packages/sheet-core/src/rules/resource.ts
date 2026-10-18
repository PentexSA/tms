import type { ResourceValue } from '../contract'
import { resource as resourceType } from '../fields/resource'
import type { ResolvedResource } from '../resolve'

// Gastar, recuperar e sofrer dano num resource, respeitando 0 e o teto
// resolvido (permanente, máximo ou nenhum com overMax). Devolve o valor novo
// no formato de sheet_data.

const base = (r: ResolvedResource) => resourceType.stored(r) as ResourceValue

export function spend(r: ResolvedResource, amount: number): ResourceValue {
  return { ...base(r), current: Math.max(0, r.current - Math.max(0, amount)) }
}

export function gain(r: ResolvedResource, amount: number): ResourceValue {
  const next = r.current + Math.max(0, amount)
  return { ...base(r), current: r.cap === null ? next : Math.min(r.cap, next) }
}

// Dano: com `tempFirst` (PV do D&D), consome primeiro os temporários.
export function takeDamage(r: ResolvedResource, amount: number): ResourceValue {
  const n = Math.max(0, amount)
  if (r.field.def.rule !== 'tempFirst') return spend(r, n)
  const temp = r.temp ?? 0
  const fromTemp = Math.min(temp, n)
  return {
    ...base(r),
    temp: temp - fromTemp,
    current: Math.max(0, r.current - (n - fromTemp)),
  }
}

// Valor digitado ou do stepper, dentro de 0..teto.
export function setCurrent(
  r: ResolvedResource,
  current: number
): ResourceValue {
  const n = Math.max(0, Math.floor(current))
  return { ...base(r), current: r.cap === null ? n : Math.min(r.cap, n) }
}
