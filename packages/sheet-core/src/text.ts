// Texto curto e frase acessível (gramática do design system, §9.2). O sinal
// visual é o menos tipográfico (U+2212); falado, "mais" e "menos".

export const MINUS = '−'

export const fmtSigned = (n: number): string =>
  n > 0 ? `+${n}` : n < 0 ? `${MINUS}${-n}` : '+0'

export const saySigned = (n: number): string =>
  n > 0 ? `mais ${n}` : n < 0 ? `menos ${-n}` : 'zero'

export const fmtPenalty = (p: number | null): string =>
  p === null ? 'incapacitado' : p === 0 ? 'sem penalidade' : `${MINUS}${-p}`

export const plural = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`
