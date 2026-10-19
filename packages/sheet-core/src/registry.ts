// Listas fechadas do contrato (design/templates/README.md §9).
//
// Tudo o que o template referencia por nome vem daqui. Os `enum` de
// design/templates/schema.json são os mesmos: o teste registry.test.ts compara
// as duas fontes, e uma não muda sem a outra.

export const REGISTRY = {
  fieldTypes: [
    'rating',
    'number',
    'percent',
    'resource',
    'track',
    'slots',
    'clock',
    'state',
    'mark',
    'text',
    'longText',
    'choice',
    'tags',
    'list',
  ],
  numberDisplays: ['plain', 'score+mod', 'signed', 'ladder'],
  percentDisplays: ['percent', 'percent+half+fifth'],
  derive: [
    'abilityModifier',
    'proficiencyBonus',
    'dnd5eCheckBonus',
    'vtmBloodPool',
    'vtmBloodPerTurn',
    'vtmGeneration',
    'cocHitPoints',
    'cocMagicPoints',
    'cocSanityMax',
    'half',
    'fifth',
  ],
  trackRules: ['wod-stacking', 'boxes'],
  resourceRules: ['tempFirst'],
  clockRules: ['mage-quint-paradox'],
  atZero: ['deathSaves'],
  effects: [
    'health.heal',
    'resource.spend',
    'resource.gain',
    'rest.long',
    'rest.short',
  ],
  rollModels: [
    'pool-success',
    'sum-vs-target',
    'roll-under-percent',
    'fudge',
    'pbta-2d6',
  ],
  dice: [2, 3, 4, 6, 8, 10, 12, 20, 100],
  diceNotation: ['1d20', '2d6', '1d100', '4dF'],
  boostEffects: ['autoSuccess', 'plus2'],
  specialtyRules: ['tenCountsDouble'],
  colorRoles: ['accent', 'alt-cool', 'alt-warm', 'neutral'],
  zones: ['identity', 'play', 'build', 'powers', 'lore'],
  layouts: ['grid', 'groups', 'list', 'pyramid', 'fields', 'facts', 'text'],
  filterRules: ['invested', 'proficient', 'aboveBase'],
  modes: ['play', 'edit'],
  roles: ['owner', 'storyteller', 'player'],
  defaultActions: ['spend1', 'gain1', 'damage1', 'use1'],
  modifierOps: ['add', 'set'],
  conditionRoll: ['advantage', 'disadvantage'],
  glyphs: ['augur-moon'],
  skins: ['wod', 'dnd', 'coc', 'fate'],
  slotResets: ['longRest', 'shortRest'],
} as const

export type Registry = typeof REGISTRY
export type FieldTypeName = Registry['fieldTypes'][number]
export type DeriveName = Registry['derive'][number]
export type EffectName = Registry['effects'][number]
export type RollModelName = Registry['rollModels'][number]
export type ZoneName = Registry['zones'][number]
export type LayoutName = Registry['layouts'][number]
export type RoleName = Registry['roles'][number]
export type ModeName = Registry['modes'][number]
export type SkinName = Registry['skins'][number]
export type NumberDisplay = Registry['numberDisplays'][number]
export type PercentDisplay = Registry['percentDisplays'][number]
export type TrackRule = Registry['trackRules'][number]
export type ResourceRule = Registry['resourceRules'][number]
export type ClockRule = Registry['clockRules'][number]
export type AtZeroRule = Registry['atZero'][number]
export type Die = Registry['dice'][number]
export type DiceNotation = Registry['diceNotation'][number]
export type BoostEffect = Registry['boostEffects'][number]
export type SpecialtyRule = Registry['specialtyRules'][number]
export type ColorRole = Registry['colorRoles'][number]
export type FilterRule = Registry['filterRules'][number]
export type DefaultAction = Registry['defaultActions'][number]
export type ModifierOp = Registry['modifierOps'][number]
export type ConditionRoll = Registry['conditionRoll'][number]
export type GlyphName = Registry['glyphs'][number]
export type SlotReset = Registry['slotResets'][number]

// Confere se um valor desconhecido (vindo do banco ou do cliente) está na lista.
export function isOneOf<T extends readonly unknown[]>(
  list: T,
  value: unknown
): value is T[number] {
  return list.includes(value)
}
