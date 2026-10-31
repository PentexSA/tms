/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { MAX_CHARACTERS_PER_CHRONICLE } from '../sheets/routes'
import { publishTemplate } from '../templates/publish'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  publish,
  type TestUser,
  template,
} from '../test/factories'
import {
  createTestContext,
  destroyTestDb,
  type TestContext,
} from '../test/helpers'

// Fichas: criação, leitura filtrada por papel, lista e exclusão (Etapa 12).

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let chronicleId: string

const helena = {
  name: 'Helena Varga',
  concept: 'Arquivista da Capela',
  clan: 'tremere',
  sire: 'Regente Aurélio Costa',
  nature: 'Arquiteta',
  demeanor: 'Pedante',
}

beforeEach(async () => {
  ctx = await createTestContext()
  await publish(ctx, 'vtm-v20')
  storyteller = await createUser(ctx, 'narradora')
  owner = await createUser(ctx, 'dona')
  player = await createUser(ctx, 'outro')
  chronicleId = await createChronicle(ctx, storyteller)
  await addMember(ctx, chronicleId, owner)
  await addMember(ctx, chronicleId, player)
})
afterEach(async () => {
  await destroyTestDb()
})

const create = (values: Record<string, unknown>, user = owner) =>
  as(ctx, user, 'POST', `/chronicles/${chronicleId}/characters`, { values })

interface CharacterResponse {
  id: string
  name: string
  roles: string[]
  sheetVersion: number
  templateVersion: string
  systemCode: string
  chronicle: { id: string; name: string }
  owner: { id: string; username: string }
  sheet: {
    values: Record<string, unknown>
    specialties: Record<string, string>
  }
}

describe('POST /chronicles/:id/characters', () => {
  it('cria com os campos de identidade; o resto nasce vazio', async () => {
    const res = await create({ ...helena, name: '  Helena Varga  ' })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const row = await ctx.db
      .selectFrom('characters')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row).toMatchObject({
      user_id: owner.id,
      chronicle_id: chronicleId,
      name: 'Helena Varga',
      template_version: '1.8.0',
      sheet_version: 0,
    })
    expect(row.sheet_data).toEqual({
      values: { ...helena, name: 'Helena Varga' },
      specialties: {},
    })
  })

  it('o sistema e a versão vêm da crônica, nunca do cliente', async () => {
    const t = template('vtm-v20')
    t.templateVersion = '1.8.0'
    await publishTemplate(ctx.db, t)
    const res = await create({ name: 'Nova', systemCode: 'dnd5e-2014' })
    expect(res.status).toBe(422)
    const ok = await create({ name: 'Nova' })
    const { id } = (await ok.json()) as { id: string }
    const row = await ctx.db
      .selectFrom('characters')
      .select('template_version')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
    expect(row.template_version).toBe('1.8.0')
  })

  it.each([
    [
      'atributo (fora da criação)',
      { name: 'X', strength: 5 },
      '/values/strength',
    ],
    [
      'Notas do Narrador',
      { name: 'X', storytellerNotes: 'segredo' },
      '/values/storytellerNotes',
    ],
    ['sem nome', { clan: 'tremere' }, '/values/name'],
    ['nome só com espaços', { name: '   ' }, '/values/name'],
    ['clã inexistente', { name: 'X', clan: 'admin' }, '/values/clan'],
    [
      'geração gravada (é derivada do antecedente)',
      { name: 'X', generation: 8 },
      '/values/generation',
    ],
    ['nome longo demais', { name: 'x'.repeat(81) }, '/values/name'],
  ])('422 para %s', async (_, values, path) => {
    const res = await create(values)
    expect(res.status).toBe(422)
    const body = (await res.json()) as { issues: { path: string }[] }
    expect(body.issues.map(i => i.path)).toContain(path)
  })

  it('__proto__ nos valores não entra na ficha nem polui o protótipo', async () => {
    const body = '{"values":{"name":"X","__proto__":{"admin":true}}}'
    const res = await ctx.app.handle(
      new Request(`http://localhost/chronicles/${chronicleId}/characters`, {
        method: 'POST',
        headers: { ...owner.headers, 'content-type': 'application/json' },
        body,
      })
    )
    expect([201, 400, 422]).toContain(res.status)
    expect(({} as Record<string, unknown>).admin).toBeUndefined()
    const rows = await ctx.db
      .selectFrom('characters')
      .select('sheet_data')
      .execute()
    for (const r of rows)
      expect(r.sheet_data).toEqual({ values: { name: 'X' }, specialties: {} })
  })

  it('a mensagem nunca repete o valor enviado', async () => {
    const res = await create({ name: 'X', clan: 'valor-secreto' })
    expect(await res.text()).not.toContain('valor-secreto')
  })

  it(`limite de ${MAX_CHARACTERS_PER_CHRONICLE} fichas por pessoa na crônica`, async () => {
    for (let i = 0; i < MAX_CHARACTERS_PER_CHRONICLE; i++)
      await createCharacter(ctx, owner, chronicleId, { name: `F${i}` })
    expect((await create({ name: 'Mais uma' })).status).toBe(422)
    expect((await create({ name: 'Da outra pessoa' }, player)).status).toBe(201)
  })
})

describe('GET /characters/:id', () => {
  let id: string
  beforeEach(async () => {
    id = await createCharacter(
      ctx,
      owner,
      chronicleId,
      {
        ...helena,
        strength: 2,
        storytellerNotes: 'O Regente vai cobrar o favor.',
      },
      { strength: 'Arrombar', storytellerNotes: 'x' }
    )
  })
  const get = async (user: TestUser) =>
    (await (
      await as(ctx, user, 'GET', `/characters/${id}`)
    ).json()) as CharacterResponse

  it('o narrador recebe tudo', async () => {
    const body = await get(storyteller)
    expect(body.sheet.values.storytellerNotes).toBe(
      'O Regente vai cobrar o favor.'
    )
    expect(body.roles).toEqual(['storyteller'])
    expect(body).toMatchObject({
      name: 'Helena Varga',
      systemCode: 'vtm-v20',
      templateVersion: '1.8.0',
      sheetVersion: 0,
      chronicle: { id: chronicleId, name: 'Crônica da Liberdade' },
      owner: { id: owner.id, username: 'dona' },
    })
  })

  it('a dona nunca recebe as Notas do Narrador', async () => {
    const res = await as(ctx, owner, 'GET', `/characters/${id}`)
    const text = await res.text()
    expect(text).not.toContain('Regente vai cobrar')
    const body = JSON.parse(text) as CharacterResponse
    expect(Object.hasOwn(body.sheet.values, 'storytellerNotes')).toBe(false)
    expect(Object.hasOwn(body.sheet.specialties, 'storytellerNotes')).toBe(
      false
    )
    expect(body.sheet.specialties.strength).toBe('Arrombar')
    expect(body.roles).toEqual(['owner'])
  })

  it('o outro jogador não recebe a ficha: 404, sem nenhum valor dela', async () => {
    const res = await as(ctx, player, 'GET', `/characters/${id}`)
    expect(res.status).toBe(404)
    const text = await res.text()
    for (const secret of ['Regente vai cobrar', 'Arrombar', 'Helena'])
      expect(text).not.toContain(secret)
  })

  it('o narrador dono da própria ficha tem os dois papéis', async () => {
    const own = await createCharacter(ctx, storyteller, chronicleId, {
      name: 'NPC',
    })
    const body = (await (
      await as(ctx, storyteller, 'GET', `/characters/${own}`)
    ).json()) as CharacterResponse
    expect(body.roles.sort()).toEqual(['owner', 'storyteller'])
  })
})

describe('GET /chronicles/:id/characters', () => {
  it('lista só a prévia (identidade e dock), sem campo restrito', async () => {
    await createCharacter(ctx, owner, chronicleId, {
      ...helena,
      backgrounds: [{ id: 'b1', name: 'Geração', value: 5 }],
      blood: { current: 9 },
      strength: 3,
      notes: 'nota da jogadora',
      storytellerNotes: 'segredo do narrador',
    })
    await createCharacter(ctx, player, chronicleId, { name: 'Caio' })
    type Item = {
      name: string
      mine: boolean
      owner: { username: string }
      values: Record<string, unknown>
    }
    const res = await as(
      ctx,
      owner,
      'GET',
      `/chronicles/${chronicleId}/characters`
    )
    const text = await res.text()
    expect(text).not.toContain('segredo do narrador')
    expect(text).not.toContain('nota da jogadora')
    const list = JSON.parse(text) as Item[]
    expect(list.map(c => [c.name, c.mine, c.owner.username])).toEqual([
      ['Helena Varga', true, 'dona'],
    ])
    expect(Object.keys(list[0]?.values ?? {}).sort()).toEqual(
      // Os Antecedentes vão junto: a Geração (no resumo) deriva deles
      ['backgrounds', 'blood', 'clan', 'concept', 'name'].sort()
    )
    // O outro jogador recebe só a dele: nada da ficha da dona no corpo
    const other = await as(
      ctx,
      player,
      'GET',
      `/chronicles/${chronicleId}/characters`
    )
    const otherText = await other.text()
    expect(otherText).not.toContain('Helena')
    expect((JSON.parse(otherText) as Item[]).map(c => c.name)).toEqual(['Caio'])
    // O narrador, todas
    const all = (await (
      await as(ctx, storyteller, 'GET', `/chronicles/${chronicleId}/characters`)
    ).json()) as Item[]
    expect(all.map(c => [c.name, c.mine])).toEqual([
      ['Helena Varga', false],
      ['Caio', false],
    ])
  })

  it('a contagem de fichas da crônica conta só o que quem pergunta vê', async () => {
    await createCharacter(ctx, owner, chronicleId, { name: 'Uma' })
    await createCharacter(ctx, owner, chronicleId, { name: 'Duas' })
    await createCharacter(ctx, player, chronicleId, { name: 'Caio' })
    const count = async (user: typeof owner) =>
      (
        (await (await as(ctx, user, 'GET', '/chronicles')).json()) as {
          characterCount: number
        }[]
      )[0]?.characterCount
    expect(await count(owner)).toBe(2)
    expect(await count(player)).toBe(1)
    expect(await count(storyteller)).toBe(3)
  })

  it('ficha excluída some da lista e da contagem da crônica', async () => {
    const id = await createCharacter(ctx, owner, chronicleId, { name: 'Some' })
    expect((await as(ctx, owner, 'DELETE', `/characters/${id}`)).status).toBe(
      204
    )
    const list = (await (
      await as(ctx, owner, 'GET', `/chronicles/${chronicleId}/characters`)
    ).json()) as unknown[]
    expect(list).toEqual([])
    const chronicles = (await (
      await as(ctx, owner, 'GET', '/chronicles')
    ).json()) as {
      characterCount: number
    }[]
    expect(chronicles[0]?.characterCount).toBe(0)
    expect((await as(ctx, owner, 'GET', `/characters/${id}`)).status).toBe(404)
    expect(
      (await as(ctx, storyteller, 'DELETE', `/characters/${id}`)).status
    ).toBe(404)
  })
})

describe('GET /systems/:code/template', () => {
  it('a versão mais recente, com ETag e revalidação', async () => {
    const res = await as(ctx, player, 'GET', '/systems/vtm-v20/template')
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBe('"vtm-v20@1.8.0"')
    expect(res.headers.get('cache-control')).toBe('private, no-cache')
    expect(((await res.json()) as { system: string }).system).toBe('vtm-v20')
  })

  it('uma versão pedida é imutável e responde 304 com o ETag', async () => {
    const res = await as(
      ctx,
      player,
      'GET',
      '/systems/vtm-v20/template?version=1.8.0'
    )
    expect(res.headers.get('cache-control')).toContain('immutable')
    const again = await ctx.app.handle(
      new Request('http://localhost/systems/vtm-v20/template?version=1.8.0', {
        headers: { ...player.headers, 'if-none-match': '"vtm-v20@1.8.0"' },
      })
    )
    expect(again.status).toBe(304)
    expect(await again.text()).toBe('')
  })

  it.each([
    ['/systems/nao-existe/template', 404],
    ['/systems/vtm-v20/template?version=9.9.9', 404],
    ['/systems/vtm-v20/template?version=latest', 400],
    ['/systems/VTM/template', 400],
  ])('%s → %i', async (path, status) => {
    expect((await as(ctx, player, 'GET', path)).status).toBe(status)
  })

  it('exige sessão', async () => {
    expect(
      (await as(ctx, null, 'GET', '/systems/vtm-v20/template')).status
    ).toBe(401)
  })
})
