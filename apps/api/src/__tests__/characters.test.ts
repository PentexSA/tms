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
  useTestDb,
} from '../test/helpers'

// Um PGLite para o arquivo, restaurado a cada createTestContext
useTestDb()

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
      template_version: '1.9.0',
      sheet_version: 0,
    })
    expect(row.sheet_data).toEqual({
      values: { ...helena, name: 'Helena Varga' },
      specialties: {},
    })
  })

  it('o sistema e a versão vêm da crônica, nunca do cliente', async () => {
    const t = template('vtm-v20')
    t.templateVersion = '1.9.0'
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
    expect(row.template_version).toBe('1.9.0')
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

// T-02: dois toques em "Criar ficha" mandam a mesma chave; o servidor cria uma
describe('POST /chronicles/:id/characters: ficha do jogador idempotente', () => {
  const key = '6f1c2a9e-4b7d-4c1e-9a3f-2d5e8b7c1a40'
  const send = (
    values: Record<string, unknown>,
    clientCommandId: string,
    user = owner
  ) =>
    as(ctx, user, 'POST', `/chronicles/${chronicleId}/characters`, {
      values,
      clientCommandId,
    })
  const mine = async (user = owner) =>
    ctx.db
      .selectFrom('characters')
      .select('id')
      .where('chronicle_id', '=', chronicleId)
      .where('user_id', '=', user.id)
      .execute()

  it('a mesma chave cria uma ficha só: 201 e depois 200 com o mesmo id', async () => {
    const first = await send({ name: 'Isadora Vex' }, key)
    expect(first.status).toBe(201)
    const created = (await first.json()) as { id: string; duplicate: boolean }
    expect(created.duplicate).toBe(false)
    const again = await send({ name: 'Isadora Vex' }, key)
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ id: created.id, duplicate: true })
    expect(await mine()).toHaveLength(1)
    const command = await ctx.db
      .selectFrom('chronicle_commands')
      .select(['kind', 'created_by'])
      .where('client_command_id', '=', key)
      .executeTakeFirstOrThrow()
    expect(command).toEqual({ kind: 'character.create', created_by: owner.id })
    // A auditoria continua só no NPC
    const audits = await ctx.db
      .selectFrom('chronicle_audit')
      .select('action')
      .where('chronicle_id', '=', chronicleId)
      .execute()
    expect(audits.map(a => a.action)).not.toContain('character.create')
  })

  it('a mesma chave com outros dados: 409, sem o id da ficha no corpo', async () => {
    const first = await send({ name: 'Isadora Vex' }, key)
    const { id } = (await first.json()) as { id: string }
    const res = await send({ name: 'Outra' }, key)
    expect(res.status).toBe(409)
    const text = await res.text()
    expect(text).toContain('IDEMPOTENCY_CONFLICT')
    expect(text).not.toContain(id)
    expect(await mine()).toHaveLength(1)
  })

  it('a mesma chave mandada por outro membro: 409, sem o id', async () => {
    const first = await send({ name: 'Isadora Vex' }, key)
    const { id } = (await first.json()) as { id: string }
    const res = await send({ name: 'Isadora Vex' }, key, player)
    expect(res.status).toBe(409)
    expect(await res.text()).not.toContain(id)
    expect(await mine(player)).toHaveLength(0)
  })

  it('a ficha do jogador e o NPC com a mesma chave não se confundem', async () => {
    const npc = await as(
      ctx,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      { kind: 'npc', values: { name: 'Isadora Vex' }, clientCommandId: key }
    )
    expect(npc.status).toBe(201)
    const res = await send({ name: 'Isadora Vex' }, key, storyteller)
    expect(res.status).toBe(409)
  })

  it('repetir no limite devolve a mesma ficha; chave nova no limite é recusada', async () => {
    for (let i = 0; i < MAX_CHARACTERS_PER_CHRONICLE - 1; i++)
      await createCharacter(ctx, owner, chronicleId, { name: `F${i}` })
    const first = await send({ name: 'Vigésima' }, key)
    expect(first.status).toBe(201)
    const { id } = (await first.json()) as { id: string }
    const again = await send({ name: 'Vigésima' }, key)
    expect(again.status).toBe(200)
    expect(((await again.json()) as { id: string }).id).toBe(id)
    const other = await send(
      { name: 'Vigésima primeira' },
      '0b6f7e3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
    )
    expect(other.status).toBe(422)
    expect(await mine()).toHaveLength(MAX_CHARACTERS_PER_CHRONICLE)
  })

  it('membro removido repete a chave: 403 antes da repetição, sem o id', async () => {
    const first = await send({ name: 'Isadora Vex' }, key)
    expect(first.status).toBe(201)
    const { id } = (await first.json()) as { id: string }
    const removed = await as(
      ctx,
      storyteller,
      'DELETE',
      `/chronicles/${chronicleId}/members/${owner.id}`
    )
    expect(removed.status).toBe(204)
    // O ex-membro (tem ficha, não tem vínculo) é barrado antes de a chave
    // ser consultada: a repetição não devolve o id
    const again = await send({ name: 'Isadora Vex' }, key)
    expect(again.status).toBe(403)
    const text = await again.text()
    expect(text).toContain('NOT_MEMBER')
    expect(text).not.toContain(id)
  })

  it('sem chave continua criando (app antigo)', async () => {
    expect((await create({ name: 'A' })).status).toBe(201)
    expect((await create({ name: 'A' })).status).toBe(201)
    expect(await mine()).toHaveLength(2)
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
      templateVersion: '1.9.0',
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
    expect(res.headers.get('etag')).toBe('"vtm-v20@1.9.0"')
    expect(res.headers.get('cache-control')).toBe('private, no-cache')
    expect(((await res.json()) as { system: string }).system).toBe('vtm-v20')
  })

  it('uma versão pedida é imutável e responde 304 com o ETag', async () => {
    const res = await as(
      ctx,
      player,
      'GET',
      '/systems/vtm-v20/template?version=1.9.0'
    )
    // Exceção ao no-store do T-13: o template não tem dado de usuário, e a
    // versão publicada é imutável. Nunca public
    expect(res.headers.get('cache-control')).toBe(
      'private, max-age=31536000, immutable'
    )
    const again = await ctx.app.handle(
      new Request('http://localhost/systems/vtm-v20/template?version=1.9.0', {
        headers: { ...player.headers, 'if-none-match': '"vtm-v20@1.9.0"' },
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
