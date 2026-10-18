// Texto de apoio do modo Evoluir. Nada aqui conhece sistema: rótulos vêm do
// template (itemLabel, label das seções).

/** Para busca: sem acento e sem caixa ("Ocultismo" acha "ocultismo"). */
export const fold = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

// Substantivos masculinos terminados em "a" que aparecem em fichas.
const MASCULINE_A = new Set([
  'carisma',
  'cometa',
  'dia',
  'dilema',
  'drama',
  'enigma',
  'esquema',
  'idioma',
  'mapa',
  'planeta',
  'poema',
  'prisma',
  'problema',
  'programa',
  'sistema',
  'tema',
])

/**
 * "Nenhuma Disciplina", "Nenhum Antecedente", "Nenhuma Magia", "Nenhum Dom".
 * O template só dá o rótulo do item; o gênero sai do substantivo principal
 * (a primeira palavra: "Arma de fogo" → "arma").
 */
export function noneOf(itemLabel: string): string {
  const head = fold(itemLabel).split(/\s+/)[0] ?? ''
  const feminine = head.endsWith('a') && !MASCULINE_A.has(head)
  return `${feminine ? 'Nenhuma' : 'Nenhum'} ${itemLabel}`
}

/** Id curto e único na lista ("i4"): o validador aceita até 40 caracteres. */
export function nextItemId(items: readonly { readonly id: string }[]): string {
  const used = new Set(items.map(i => i.id))
  let n = items.length + 1
  while (used.has(`i${n}`)) n++
  return `i${n}`
}
