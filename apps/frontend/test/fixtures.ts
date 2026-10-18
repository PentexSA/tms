import {
  compileTemplate,
  type SheetData,
  type SheetModel,
  stripRestricted,
} from '@tms/sheet-core'

// Os mesmos fixtures do core: templates e fichas de design/ (nada copiado).
type Json = Record<string, unknown>
const templates: Record<string, Json> = {
  'vtm-v20': require('../../../design/templates/vtm-v20.json'),
  'dnd5e-2014': require('../../../design/templates/dnd5e-2014.json'),
  'mta-m20': require('../../../design/templates/mta-m20.json'),
  'wta-w20': require('../../../design/templates/wta-w20.json'),
  coc7e: require('../../../design/templates/coc7e.json'),
  'fate-core': require('../../../design/templates/fate-core.json'),
}
const examples: { id: string; system: string; sheet: SheetData }[] =
  require('../../../design/templates/exemplos/personagens.json').characters

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

/** Os ids de todas as fichas de exemplo (todos os sistemas). */
export const exampleIds = (): string[] => examples.map(c => c.id)

export const templateJson = (system: string): Json =>
  clone(templates[system] as Json)

export const modelOf = (system: string): SheetModel =>
  compileTemplate(templates[system])

export function example(id: string) {
  const c = examples.find(x => x.id === id)
  if (!c) throw new Error(`fixture ausente: ${id}`)
  return clone(c)
}

/** A ficha como a API manda para quem tem esses papéis. */
export const sheetFor = (
  id: string,
  roles: readonly string[]
): { model: SheetModel; sheet: SheetData } => {
  const c = example(id)
  const model = modelOf(c.system)
  return { model, sheet: stripRestricted(model, c.sheet, roles) }
}

export const VAMPIRES = ['helena', 'caio', 'marta', 'beto'] as const
