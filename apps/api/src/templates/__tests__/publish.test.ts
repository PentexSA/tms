/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type DB, migrations, PRODUCT_TEMPLATES } from '@tms/db'
import { createPGliteTestDb } from '@tms/db/testing'
import { compileTemplate } from '@tms/sheet-core'
import type { Kysely } from 'kysely'
import { main } from '../../scripts/publish-template'
import {
  canonicalJson,
  PublishError,
  publishTemplate,
  schemaIssues,
} from '../publish'
import { PUBLISHED_SYSTEMS, publishedFiles } from '../published'

const DESIGN = join(import.meta.dir, '../../../../../design')

// A publicação parte de um banco sem templates: o schema todo, menos a
// migration que grava os templates do produto
const beforeProductTemplates = {
  getMigrations: async () =>
    Object.fromEntries(
      Object.entries(migrations).filter(
        ([name]) =>
          name !== '0020_product_templates' && name !== '0023_templates_onda4'
      )
    ),
}
const SYSTEMS = [
  'vtm-v20',
  'dnd5e-2014',
  'mta-m20',
  'wta-w20',
  'coc7e',
  'fate-core',
] as const
type Json = Record<string, unknown>
const template = (system: string): Json =>
  JSON.parse(readFileSync(join(DESIGN, `templates/${system}.json`), 'utf8'))

const rejection = async (p: Promise<unknown>): Promise<PublishError> => {
  try {
    await p
  } catch (e) {
    if (e instanceof PublishError) return e
    throw e
  }
  throw new Error('a publicação deveria ter sido recusada')
}

describe('schema.json (Ajv)', () => {
  it('recusa recoveries com efeito desconhecido e parâmetros fora do contrato', () => {
    for (const effect of [
      { effect: 'code.execute' },
      { effect: 'resource.restore', params: { field: 'willpower', amount: 1 } },
      { effect: 'resource.gain', params: { field: 'willpower' } },
    ]) {
      const t = template('vtm-v20')
      t.recoveries = [
        {
          id: 'rest',
          label: 'Descanso',
          help: 'Recuperação.',
          effects: [effect],
        },
      ]
      expect(schemaIssues(t).length).toBeGreaterThan(0)
    }
  })
  it.each([...SYSTEMS])('%s passa no schema', system => {
    expect(schemaIssues(template(system))).toEqual([])
  })

  // Casos que só o schema pega: é o motivo de existirem as duas camadas.
  it.each([
    [
      'rótulo com quebra de linha',
      (t: Json) => {
        ;(t.fields as Record<string, Json>).name = {
          type: 'text',
          label: 'Nome\ncompleto',
        }
      },
    ],
    [
      'facts com groups',
      (t: Json) => {
        const [first] = t.sections as Json[]
        if (first) first.groups = [{ id: 'g', title: 'G', fields: ['name'] }]
      },
    ],
    [
      'pinTop fora da zona play',
      (t: Json) => {
        const [first] = t.sections as Json[]
        if (first) first.pinTop = true
      },
    ],
    [
      'propriedade que o tipo não tem',
      (t: Json) => {
        ;(t.fields as Record<string, Json>).name = {
          type: 'text',
          label: 'Nome',
          readOnly: true,
        }
      },
    ],
    [
      'default como expressão em texto (nunca fórmula interpretada)',
      (t: Json) => {
        const f = t.fields as Record<string, Json>
        f.humanity = { ...f.humanity, default: 'conscience + selfControl' }
      },
    ],
    [
      'default com derivação e mapa ao mesmo tempo',
      (t: Json) => {
        const f = t.fields as Record<string, Json>
        f.humanity = {
          ...f.humanity,
          default: { derive: 'sum', from: 'courage', map: { brujah: 1 } },
        }
      },
    ],
    [
      'mapa com valor quebrado',
      (t: Json) => {
        const f = t.fields as Record<string, Json>
        f.humanity = {
          ...f.humanity,
          default: { from: 'clan', map: { brujah: 1.5 } },
        }
      },
    ],
  ])('rejeita: %s', (_, mutate) => {
    const t = template('vtm-v20')
    mutate(t)
    expect(schemaIssues(t).length).toBeGreaterThan(0)
  })

  it('aceita default com fórmula no rating, no permanente e na roda', () => {
    const t = template('vtm-v20')
    const f = t.fields as Record<string, Json>
    f.humanity = {
      ...f.humanity,
      default: { derive: 'sum', from: ['conscience', 'selfControl'] },
    }
    f.willpower = {
      ...f.willpower,
      permanent: {
        min: 1,
        max: 10,
        default: { from: 'clan', map: { brujah: 3 } },
      },
    }
    expect(schemaIssues(t)).toEqual([])
    const m = template('mta-m20')
    const wheel = (m.fields as Record<string, Json>).wheel as Json & {
      fills: Json[]
    }
    wheel.fills = wheel.fills.map(x => ({ ...x, default: 2 }))
    expect(schemaIssues(m)).toEqual([])
  })
})

describe('publishTemplate', () => {
  let db: Kysely<DB>
  let destroy: () => Promise<void>

  beforeEach(async () => {
    ;({ db, destroy } = await createPGliteTestDb(beforeProductTemplates))
  })
  afterEach(async () => {
    await destroy()
  })

  it('publica o Vampiro e cria o sistema', async () => {
    const result = await publishTemplate(db, template('vtm-v20'))
    expect(result).toMatchObject({
      status: 'published',
      system: 'vtm-v20',
      version: '1.9.0',
    })
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
    const system = await db
      .selectFrom('game_systems')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(system).toMatchObject({ code: 'vtm-v20', family: 'wod' })
    const row = await db
      .selectFrom('trait_templates')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(row.version).toBe('1.9.0')
    expect(row.published_at).toBeInstanceOf(Date)
    expect(canonicalJson(row.template_data)).toBe(
      canonicalJson(template('vtm-v20'))
    )
  })

  it('republicar o mesmo conteúdo é no-op, mesmo com outra ordem de chaves', async () => {
    const first = await publishTemplate(db, template('vtm-v20'))
    const reordered = Object.fromEntries(
      Object.entries(template('vtm-v20')).reverse()
    )
    const again = await publishTemplate(db, reordered)
    expect(again).toEqual({ ...first, status: 'unchanged' })
    const { count } = await db
      .selectFrom('trait_templates')
      .select(db.fn.countAll().as('count'))
      .executeTakeFirstOrThrow()
    expect(Number(count)).toBe(1)
  })

  it('a mesma versão com outro conteúdo é recusada (versão imutável)', async () => {
    await publishTemplate(db, template('vtm-v20'))
    const changed = template('vtm-v20')
    changed.license = 'outra licença'
    const error = await rejection(publishTemplate(db, changed))
    expect(error.issues).toEqual([
      {
        stage: 'version',
        path: 'templateVersion',
        message:
          'vtm-v20@1.9.0 já foi publicado com outro conteúdo: suba o templateVersion',
      },
    ])
  })

  it('uma versão nova convive com a anterior', async () => {
    await publishTemplate(db, template('vtm-v20'))
    const next = template('vtm-v20')
    next.templateVersion = '1.10.0'
    expect((await publishTemplate(db, next)).status).toBe('published')
    const versions = await db
      .selectFrom('trait_templates')
      .select('version')
      .orderBy('version')
      .execute()
    // A ordem da coluna é a de texto: '1.10.0' vem antes de '1.9.0'
    expect(versions.map(v => v.version)).toEqual(['1.10.0', '1.9.0'])
  })

  it.each([
    [null, 'json'],
    [[], 'json'],
    ['vtm-v20', 'json'],
  ])('recusa o que não é objeto (%p)', async (json, stage) => {
    const error = await rejection(publishTemplate(db, json))
    expect(error.issues[0]?.stage).toBe(stage as 'json')
  })

  it('o schema roda antes do contrato e nada é gravado', async () => {
    const t = template('vtm-v20')
    t.onclick = 'alert(1)'
    const error = await rejection(publishTemplate(db, t))
    expect(error.issues.every(i => i.stage === 'schema')).toBe(true)
    const rows = await db.selectFrom('game_systems').select('id').execute()
    expect(rows).toEqual([])
  })

  it('o contrato pega o que o schema não expressa', async () => {
    const t = template('vtm-v20')
    t.dock = ['storytellerNotes']
    const error = await rejection(publishTemplate(db, t))
    expect(error.issues).toContainEqual({
      stage: 'contract',
      path: 'dock',
      message: "campo 'storytellerNotes' é de seção com leitura restrita",
    })
  })

  // P07-D: as quatro chaves novas passam pelas duas camadas (schema.json e
  // validateTemplate). Nomes de Dom fictícios: o catálogo é do time.
  const withNewKeys = () => {
    const t = template('wta-w20')
    const fields = t.fields as Record<string, Json>
    const gifts = fields.gifts as Json
    gifts.catalog = ['Faro do Asfalto', 'Passo de Neblina']
    gifts.catalogDefaults = [
      { meta: 'rank', value: 2, items: ['Passo de Neblina'] },
    ]
    gifts.recommend = {
      outside: 'fora da Tribo',
      by: [
        {
          from: 'tribe',
          label: 'da Tribo',
          map: { fianna: ['Faro do Asfalto'] },
        },
      ],
    }
    ;(t.creation as Json).advice = [
      { rule: 'item-meta-max', targets: ['gifts'], meta: 'rank', max: 1 },
    ]
    return t
  }

  it('publica com recommend, catalogDefaults e creation.advice', async () => {
    const t = withNewKeys()
    expect(schemaIssues(t)).toEqual([])
    expect((await publishTemplate(db, t)).status).toBe('published')
  })

  it('recommend inválido: o schema recusa a forma, o contrato recusa o nome', async () => {
    const shape = withNewKeys()
    const gifts = (shape.fields as Record<string, Json>).gifts as Json
    gifts.recommend = { outside: '<b>x</b>', by: [] }
    const bad = await rejection(publishTemplate(db, shape))
    expect(bad.issues.length).toBeGreaterThan(0)
    expect(bad.issues.every(i => i.stage === 'schema')).toBe(true)
    // A forma certa, com um nome fora do catálogo: só o contrato pega
    const names = withNewKeys()
    const recommend = ((names.fields as Record<string, Json>).gifts as Json)
      .recommend as { by: Json[] }
    ;(recommend.by[0] as Json).map = { fianna: ['Dom Inventado'] }
    expect(schemaIssues(names)).toEqual([])
    const refused = await rejection(publishTemplate(db, names))
    expect(refused.issues).toContainEqual({
      stage: 'contract',
      path: 'fields.gifts.recommend.by.0.map.fianna',
      message: "'Dom Inventado' não está no catálogo",
    })
  })

  it('o texto por opção (Fraqueza) com quebra de linha é recusado', async () => {
    const t = template('vtm-v20')
    const fields = t.fields as Record<string, Json>
    ;(fields.weakness as Json).default = {
      from: 'clan',
      map: { brujah: 'uma\nduas' },
    }
    const error = await rejection(publishTemplate(db, t))
    expect(error.issues[0]?.stage).toBe('schema')
  })

  it('ciclo de teto (só o compile pega) também é recusado', async () => {
    const t = template('vtm-v20')
    const fields = t.fields as Record<string, Json>
    if (fields.strength && fields.dexterity) {
      fields.strength.cap = { field: 'dexterity', label: 'x' }
      fields.dexterity.cap = { field: 'strength', label: 'y' }
    }
    const error = await rejection(publishTemplate(db, t))
    expect(error.issues[0]).toMatchObject({ stage: 'contract' })
    expect(error.issues[0]?.message).toContain('dependência circular')
  })
})

// R-19 (P10-D): a frase de ajuda nas opções, nos grupos e nos itens fixos.
// As duas camadas (Ajv e contrato) recusam a frase com link, grande ou com
// marcação, e a recusa não ecoa a frase.
type Help = (t: Json, help: string) => void
const fieldsOf = (t: Json) => t.fields as Record<string, Json>
const clanOption: Help = (t, help) => {
  const [o] = (fieldsOf(t).clan?.options ?? []) as Json[]
  if (o) o.help = help
}
const attributesGroup: Help = (t, help) => {
  const s = (t.sections as Json[]).find(x => x.id === 'attributes')
  const [g] = (s?.groups ?? []) as Json[]
  if (g) g.help = help
}
// Commit 7: a frase de um nome do catálogo, no mapa ao lado da lista
const catalogHelp: Help = (t, help) => {
  const f = fieldsOf(t).backgrounds as Json
  f.catalogHelp = { ...(f.catalogHelp as Json), Aliados: help }
}
const humanityHelp: Help = (t, help) => {
  const f = fieldsOf(t).humanity
  if (f) f.help = help
}
const ADDED = 'texto-de-teste'

describe('ajuda no template (R-19)', () => {
  it('o Ajv aceita a frase na opção, no grupo, no item fixo e na Forma', () => {
    const v = template('vtm-v20')
    clanOption(v, 'Frase curta do time.')
    attributesGroup(v, 'Frase curta do time.')
    expect(schemaIssues(v)).toEqual([])
    const m = template('mta-m20')
    const [fixed] = (fieldsOf(m).resonance?.fixed ?? []) as Json[]
    if (fixed) fixed.help = 'Frase curta do time.'
    expect(schemaIssues(m)).toEqual([])
    const w = template('wta-w20')
    const [form] = (fieldsOf(w).form?.options ?? []) as Json[]
    if (form) form.help = 'Frase curta do time.'
    expect(schemaIssues(w)).toEqual([])
  })

  it.each([
    ['link na opção', clanOption, `${ADDED} https://exemplo.test`],
    ['www na opção', clanOption, `${ADDED} WWW.exemplo.test`],
    ['opção acima de 200', clanOption, ADDED + 'a'.repeat(200)],
    ['marcação no grupo', attributesGroup, `<b>${ADDED}</b>`],
    ['quebra de linha no grupo', attributesGroup, `${ADDED}\nmais`],
    ['link no help do campo', humanityHelp, `${ADDED} www.exemplo.test`],
    ['link no catálogo', catalogHelp, `${ADDED} https://exemplo.test`],
    ['catálogo acima de 200', catalogHelp, ADDED + 'a'.repeat(200)],
  ] as [string, Help, string][])(
    'recusa %s, sem gravar e sem ecoar a frase',
    async (_, put, help) => {
      const { db, destroy } = await createPGliteTestDb(beforeProductTemplates)
      try {
        const t = template('vtm-v20')
        put(t, help)
        expect(schemaIssues(t).length).toBeGreaterThan(0)
        const error = await rejection(publishTemplate(db, t))
        expect(error.issues.every(i => i.stage === 'schema')).toBe(true)
        for (const i of error.issues) {
          expect(i.message).not.toContain(ADDED)
          expect(i.path).not.toContain(ADDED)
        }
        const rows = await db.selectFrom('game_systems').select('id').execute()
        expect(rows).toEqual([])
      } finally {
        await destroy()
      }
    }
  )

  it('o core repete o "sem link" só na publicação; a leitura fica tolerante', async () => {
    const t = template('vtm-v20')
    clanOption(t, `${ADDED} https://exemplo.test`)
    const { PALETTE, publicationIssues, validateTemplate } = await import(
      '@tms/sheet-core'
    )
    const [option] = (fieldsOf(t).clan?.options ?? []) as Json[]
    expect(publicationIssues(t)).toEqual([
      {
        path: `fields.clan.options.${option?.id}.help`,
        message: 'ajuda com link (://, www.): a frase é texto puro',
      },
    ])
    // O compileTemplate do app roda o validateTemplate em versões já
    // publicadas: uma regra nova ali derrubaria uma ficha antiga
    expect(validateTemplate(t, PALETTE)).toEqual([])
  })

  it('a opção de tags não aceita help (o app não a desenha)', () => {
    const t = template('dnd5e-2014')
    const tags = Object.values(fieldsOf(t)).find(f => f.type === 'tags')
    const [option] = (tags?.options ?? []) as Json[]
    if (option) option.help = 'Frase curta.'
    expect(option).toBeDefined()
    expect(schemaIssues(t).length).toBeGreaterThan(0)
  })

  it('o template com frases é publicado', async () => {
    const { db, destroy } = await createPGliteTestDb(beforeProductTemplates)
    try {
      const t = template('vtm-v20')
      clanOption(t, 'Frase curta do time.')
      attributesGroup(t, 'Frase curta do time.')
      humanityHelp(t, 'Frase do campo, sem link.')
      const result = await publishTemplate(db, t)
      expect(result.status).toBe('published')
    } finally {
      await destroy()
    }
  })
})

describe('pnpm templates:publish (CLI)', () => {
  let db: Kysely<DB>
  let destroy: () => Promise<void>
  let dir: string
  let out: string[]
  let err: string[]
  const run = (files: string[]) =>
    main(files, {
      db,
      cwd: dir,
      out: l => out.push(l),
      err: l => err.push(l),
    })

  beforeEach(async () => {
    ;({ db, destroy } = await createPGliteTestDb(beforeProductTemplates))
    dir = mkdtempSync(join(tmpdir(), 'tms-publish-'))
    out = []
    err = []
  })
  afterEach(async () => {
    await destroy()
    rmSync(dir, { recursive: true, force: true })
  })

  it('publica um arquivo e diz sistema, versão e hash (sem conteúdo)', async () => {
    writeFileSync(join(dir, 'vtm.json'), JSON.stringify(template('vtm-v20')))
    expect(await run(['vtm.json'])).toBe(0)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatch(
      /^publicado: vtm-v20@1\.9\.0 \(sha256 [0-9a-f]{12}\)$/
    )
    expect(await run(['vtm.json'])).toBe(0)
    expect(out[1]).toStartWith('sem mudança: vtm-v20@1.9.0')
  })

  it('sai com 1 e lista os problemas quando recusa', async () => {
    const t = template('vtm-v20')
    t.skin = 'neon'
    writeFileSync(join(dir, 'ruim.json'), JSON.stringify(t))
    writeFileSync(join(dir, 'quebrado.json'), '{ nao é json')
    expect(await run(['ruim.json', 'quebrado.json'])).toBe(1)
    expect(err[0]).toBe('recusado: ruim.json')
    expect(err.some(l => l.startsWith('  - [schema] /skin'))).toBe(true)
    expect(err.some(l => l.startsWith('falhou: quebrado.json'))).toBe(true)
  })

  it('sem arquivo, mostra o uso', async () => {
    expect(await run([])).toBe(1)
    expect(err).toEqual([
      'Uso: pnpm templates:publish <template.json> [...] | --published',
    ])
  })

  it('--published grava os templates do produto, na ordem', async () => {
    expect(await run(['--published'])).toBe(0)
    expect(out.map(l => l.split(' (')[0])).toEqual([
      'publicado: vtm-v20@1.9.0',
      'publicado: mta-m20@1.7.0',
      'publicado: wta-w20@1.7.0',
    ])
  })
})

describe('os templates do produto (plano-v1, Etapa 7; plano-v2, Etapa 6)', () => {
  const examples = (
    JSON.parse(
      readFileSync(join(DESIGN, 'templates/exemplos/personagens.json'), 'utf8')
    ) as { characters: { system: string }[] }
  ).characters

  // O que as migrations dos templates do produto (0020, 0023) gravam passa
  // pelas mesmas camadas do publishTemplate. A migration não as roda: o
  // @tms/db não depende do core nem do Ajv (onda-4.md, revisão do P10-D)
  it.each([...PRODUCT_TEMPLATES] as string[])(
    '%s: o arquivo que a migration grava passa no schema, no contrato e na publicação',
    async (system: string) => {
      const { publicationIssues, validateTemplate, PALETTE } = await import(
        '@tms/sheet-core'
      )
      const t = template(system)
      expect(schemaIssues(t)).toEqual([])
      expect(validateTemplate(t, PALETTE)).toEqual([])
      expect(publicationIssues(t)).toEqual([])
      expect(() => compileTemplate(t)).not.toThrow()
    }
  )

  it('a lista é Vampiro, Mago e Lobisomem, e cada arquivo existe', () => {
    expect([...PUBLISHED_SYSTEMS]).toEqual(['vtm-v20', 'mta-m20', 'wta-w20'])
    expect(publishedFiles().map(f => f.split('/').at(-1))).toEqual([
      'vtm-v20.json',
      'mta-m20.json',
      'wta-w20.json',
    ])
  })

  it.each([...PUBLISHED_SYSTEMS])(
    '%s passa no Ajv, compila e tem ficha de exemplo',
    system => {
      const t = template(system)
      expect(schemaIssues(t)).toEqual([])
      expect(compileTemplate(t).system).toBe(system)
      expect(examples.some(c => c.system === system)).toBe(true)
    }
  )
})

describe('o Ajv fica fora do app e do core', () => {
  it.each([
    ['packages/sheet-core/package.json'],
    ['apps/frontend/package.json'],
    ['packages/ui/package.json'],
  ])('%s não depende de ajv', file => {
    const pkg = JSON.parse(
      readFileSync(join(DESIGN, '..', file), 'utf8')
    ) as Record<string, Record<string, string> | undefined>
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies'])
      expect(Object.keys(pkg[key] ?? {})).not.toContain('ajv')
  })
})
