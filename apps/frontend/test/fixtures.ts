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

// Dons fictícios (P07-D): os testes do mecanismo usam nomes inventados, com
// Posto e recomendação, para não depender do catálogo do produto (onda 4),
// que tem os próprios casos com `templateJson('wta-w20')`
export const GIFTS = {
  breed: 'Faro do Asfalto',
  auspice: 'Grito de Alerta',
  tribe: 'Voz da Matilha',
  rank2: 'Passo de Neblina',
  other: 'Pele de Pedra',
} as const

/**
 * O template com `recommend`, `catalogDefaults` e `creation.advice` de
 * teste: as Disciplinas do Brujah (as mesmas do XP do template), os Dons
 * fictícios do Lupino Ahroun Fianna e as Esferas da Verbena. Igual antes e
 * depois de o conteúdo do time entrar nos templates do produto.
 */
export function templateWithIdentity(system: string): Json {
  const t = templateJson(system)
  const fields = t.fields as Record<string, Json>
  if (system === 'vtm-v20' && fields.disciplines)
    fields.disciplines.recommend = {
      outside: 'fora do clã',
      by: [
        {
          from: 'clan',
          label: 'do clã',
          map: {
            brujah: ['Rapidez', 'Potência', 'Presença'],
            tremere: ['Auspícios', 'Dominação', 'Taumaturgia'],
          },
        },
      ],
    }
  // Resumos fictícios, para os testes do mecanismo não fixarem o texto do time
  if (system === 'vtm-v20' && fields.weakness)
    fields.weakness.default = {
      from: 'clan',
      map: {
        brujah: 'Resumo fictício de teste A.',
        toreador: 'Resumo fictício de teste B.',
      },
    }
  if (system === 'wta-w20' && fields.gifts) {
    fields.gifts.catalog = Object.values(GIFTS)
    // As frases do catálogo do produto citam nomes que este catálogo não tem
    delete fields.gifts.catalogHelp
    fields.gifts.catalogDefaults = [
      {
        meta: 'rank',
        value: 1,
        items: [GIFTS.breed, GIFTS.auspice, GIFTS.tribe],
      },
      { meta: 'rank', value: 2, items: [GIFTS.rank2] },
    ]
    fields.gifts.recommend = {
      outside: 'fora da Raça, do Augúrio e da Tribo',
      by: [
        { from: 'breed', label: 'da Raça', map: { lupino: [GIFTS.breed] } },
        {
          from: 'auspice',
          label: 'do Augúrio',
          map: { ahroun: [GIFTS.auspice] },
        },
        {
          from: 'tribe',
          label: 'da Tribo',
          map: { fianna: [GIFTS.tribe, GIFTS.breed] },
        },
      ],
    }
    ;(t.creation as Json).advice = [
      { rule: 'item-meta-max', targets: ['gifts'], meta: 'rank', max: 1 },
    ]
  }
  if (system === 'mta-m20' && fields.affinity)
    fields.affinity.recommend = {
      outside: 'fora da Tradição',
      by: [
        {
          from: 'tradition',
          label: 'da Tradição',
          map: { verbena: ['life', 'forces'] },
        },
      ],
    }
  return t
}

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
