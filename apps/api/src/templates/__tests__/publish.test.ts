/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DB } from '@tms/db'
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
  ])('rejeita: %s', (_, mutate) => {
    const t = template('vtm-v20')
    mutate(t)
    expect(schemaIssues(t).length).toBeGreaterThan(0)
  })
})

describe('publishTemplate', () => {
  let db: Kysely<DB>
  let destroy: () => Promise<void>

  beforeEach(async () => {
    ;({ db, destroy } = await createPGliteTestDb())
  })
  afterEach(async () => {
    await destroy()
  })

  it('publica o Vampiro e cria o sistema', async () => {
    const result = await publishTemplate(db, template('vtm-v20'))
    expect(result).toMatchObject({
      status: 'published',
      system: 'vtm-v20',
      version: '1.3.0',
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
    expect(row.version).toBe('1.3.0')
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
          'vtm-v20@1.3.0 já foi publicado com outro conteúdo: suba o templateVersion',
      },
    ])
  })

  it('uma versão nova convive com a anterior', async () => {
    await publishTemplate(db, template('vtm-v20'))
    const next = template('vtm-v20')
    next.templateVersion = '1.4.0'
    expect((await publishTemplate(db, next)).status).toBe('published')
    const versions = await db
      .selectFrom('trait_templates')
      .select('version')
      .orderBy('version')
      .execute()
    expect(versions.map(v => v.version)).toEqual(['1.3.0', '1.4.0'])
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
    ;({ db, destroy } = await createPGliteTestDb())
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
      /^publicado: vtm-v20@1\.3\.0 \(sha256 [0-9a-f]{12}\)$/
    )
    expect(await run(['vtm.json'])).toBe(0)
    expect(out[1]).toStartWith('sem mudança: vtm-v20@1.3.0')
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
      'publicado: vtm-v20@1.3.0',
      'publicado: mta-m20@1.2.0',
      'publicado: wta-w20@1.2.0',
    ])
  })
})

describe('os templates do produto (plano-v1, Etapa 7; plano-v2, Etapa 6)', () => {
  const examples = (
    JSON.parse(
      readFileSync(join(DESIGN, 'templates/exemplos/personagens.json'), 'utf8')
    ) as { characters: { system: string }[] }
  ).characters

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
