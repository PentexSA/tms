// Igualdade de valores JSON: objetos sem depender da ordem das chaves, listas
// na ordem. Ausente e null são iguais (campo sem valor guardado).
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => jsonEqual(x, b[i]))
  const ka = Object.keys(a).filter(
    k => (a as Record<string, unknown>)[k] != null
  )
  const kb = Object.keys(b).filter(
    k => (b as Record<string, unknown>)[k] != null
  )
  return (
    ka.length === kb.length &&
    ka.every(
      k =>
        Object.hasOwn(b, k) &&
        jsonEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k]
        )
    )
  )
}
