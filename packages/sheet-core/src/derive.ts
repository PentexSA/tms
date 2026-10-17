import type { DeriveName } from './registry'

// Derivações por nome (design/templates/README.md §9). O template só cita o
// nome; a conta mora aqui, como função pura. Nunca há expressão vinda do banco.

// Tabela de Geração da V20: [pontos de sangue, sangue por turno].
const BLOOD: Readonly<Record<number, readonly [number, number]>> = {
  4: [50, 10],
  5: [40, 8],
  6: [30, 6],
  7: [20, 4],
  8: [15, 3],
  9: [14, 2],
  10: [13, 1],
  11: [12, 1],
  12: [11, 1],
  13: [10, 1],
  14: [10, 1],
  15: [10, 1],
}
const BLOOD_DEFAULT = [10, 1] as const
const blood = (generation: number) =>
  Object.hasOwn(BLOOD, generation)
    ? (BLOOD[generation] ?? BLOOD_DEFAULT)
    : BLOOD_DEFAULT

const abilityModifier = (score: number) => Math.floor((score - 10) / 2)

export const DERIVE: Readonly<
  Record<DeriveName, (...args: number[]) => number>
> = {
  abilityModifier,
  proficiencyBonus: level => 2 + Math.floor((Math.max(1, level) - 1) / 4),
  dnd5eCheckBonus: (score, prof, multiplier) =>
    abilityModifier(score) + prof * multiplier,
  vtmBloodPool: generation => blood(generation)[0],
  vtmBloodPerTurn: generation => blood(generation)[1],
  cocHitPoints: (con, siz) => Math.floor((con + siz) / 10),
  cocMagicPoints: pow => Math.floor(pow / 5),
  cocSanityMax: mythos => 99 - mythos,
  half: v => Math.floor(v / 2),
  fifth: v => Math.floor(v / 5),
}

export function isDeriveName(name: unknown): name is DeriveName {
  return typeof name === 'string' && Object.hasOwn(DERIVE, name)
}
