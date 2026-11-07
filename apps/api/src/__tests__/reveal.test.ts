/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { compileTemplate } from '@tms/sheet-core'
import { revealedOf, revealedValues } from '../sheets/reveal'
import { publishTemplate } from '../templates/publish'
import {
  addMember,
  as,
  createCharacter,
  createChronicle,
  createUser,
  freeCreation,
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
import {
  MATRIX_SYSTEMS,
  type SystemCase,
  systemCase,
} from '../test/matrix-systems'

// U-11 (P16-D): o narrador revela ao dono as Notas do Narrador de uma ficha
// de jogador, só em leitura, e esconde de novo. O texto só sai pela rota
// própria; nenhuma saída de hoje passa a levá-lo ao dono. Nos três sistemas.

useTestDb()

const SENTINEL = 'SENTINELA-P16-nota-fixticia'

let ctx: TestContext
let storyteller: TestUser
let owner: TestUser
let player: TestUser
let otherStoryteller: TestUser
let chronicleId: string
let characterId: string

interface Reveal {
  section: string
  revealed: boolean
  sections: string[]
  revision: number
  duplicate: boolean
}

const reveal = (
  s: SystemCase,
  body: Partial<{
    clientCommandId: string
    section: string
    revealed: boolean
    revision: number
  }> = {},
  user: TestUser = storyteller,
  id = characterId
) =>
  as(ctx, user, 'POST', `/characters/${id}/reveal`, {
    clientCommandId: crypto.randomUUID(),
    section: s.revealSection,
    revealed: true,
    revision: 0,
    ...body,
  })

const readRevealed = (user: TestUser, id = characterId) =>
  as(ctx, user, 'GET', `/characters/${id}/revealed`)

const writeNotes = async (s: SystemCase, id = characterId) => {
  const res = await as(ctx, storyteller, 'POST', `/characters/${id}/events`, {
    clientBatchId: crypto.randomUUID(),
    events: [{ path: `values.${s.notesField}`, from: null, to: SENTINEL }],
  })
  expect(res.status).toBe(200)
}

const makeNpc = async (visibility: 'hidden' | 'full') => {
  const id = await createCharacter(ctx, storyteller, chronicleId, {
    name: 'NPC da revelação',
  })
  await ctx.db
    .updateTable('characters')
    .set({ kind: 'npc', visibility })
    .where('id', '=', id)
    .execute()
  return id
}

for (const system of MATRIX_SYSTEMS) {
  const s = systemCase(system)

  describe(`revelar as notas (U-11): ${system}`, () => {
    beforeEach(async () => {
      await destroyTestDb()
      ctx = await createTestContext()
      await publish(ctx, system)
      storyteller = await createUser(ctx, 'narradora-u11')
      owner = await createUser(ctx, 'dona-u11')
      player = await createUser(ctx, 'outro-u11')
      otherStoryteller = await createUser(ctx, 'narrador2-u11')
      chronicleId = await createChronicle(ctx, storyteller, system)
      await addMember(ctx, chronicleId, owner)
      await addMember(ctx, chronicleId, player)
      await createChronicle(ctx, otherStoryteller, system, 'Outra')
      characterId = await createCharacter(ctx, owner, chronicleId)
      await freeCreation(ctx, characterId)
      await writeNotes(s)
    })

    afterEach(async () => destroyTestDb())

    it('revela, o dono lê pela rota própria e não pela ficha; esconde, e some', async () => {
      // Antes: privado
      const before = await as(ctx, owner, 'GET', `/characters/${characterId}`)
      const beforeBody = (await before.json()) as {
        reveal: { sections: string[]; revision: number }
      }
      expect(beforeBody.reveal).toEqual({ sections: [], revision: 0 })
      expect(JSON.stringify(beforeBody)).not.toContain(SENTINEL)
      const none = await readRevealed(owner)
      expect(await none.json()).toEqual({ revision: 0, sections: [] })

      const res = await reveal(s)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        section: s.revealSection,
        revealed: true,
        sections: [s.revealSection],
        revision: 1,
        duplicate: false,
      })

      // A ficha do dono traz só o estado, nunca o texto
      const sheet = await as(ctx, owner, 'GET', `/characters/${characterId}`)
      const sheetText = await sheet.text()
      expect(sheetText).not.toContain(SENTINEL)
      expect(JSON.parse(sheetText).reveal).toEqual({
        sections: [s.revealSection],
        revision: 1,
      })
      // O texto, pela rota própria
      const read = await readRevealed(owner)
      expect(read.status).toBe(200)
      expect(await read.json()).toEqual({
        revision: 1,
        sections: [
          { id: s.revealSection, values: { [s.notesField]: SENTINEL } },
        ],
      })
      // O narrador lê a mesma forma ("ver como o jogador vê")
      expect(await (await readRevealed(storyteller)).json()).toEqual({
        revision: 1,
        sections: [
          { id: s.revealSection, values: { [s.notesField]: SENTINEL } },
        ],
      })

      // Revelação viva: o que o narrador salvar depois, o dono lê
      const edit = await as(
        ctx,
        storyteller,
        'POST',
        `/characters/${characterId}/events`,
        {
          clientBatchId: crypto.randomUUID(),
          events: [
            {
              path: `values.${s.notesField}`,
              from: SENTINEL,
              to: `${SENTINEL}-2`,
            },
          ],
        }
      )
      expect(edit.status).toBe(200)
      expect(
        JSON.stringify(await (await readRevealed(owner)).json())
      ).toContain(`${SENTINEL}-2`)

      // O dono nunca escreve, mesmo revelada
      const write = await as(
        ctx,
        owner,
        'POST',
        `/characters/${characterId}/events`,
        {
          clientBatchId: crypto.randomUUID(),
          events: [
            { path: `values.${s.notesField}`, from: `${SENTINEL}-2`, to: 'x' },
          ],
        }
      )
      expect(write.status).toBe(403)
      expect(await write.text()).not.toContain(SENTINEL)

      // Esconde
      const hide = await reveal(s, { revealed: false, revision: 1 })
      expect(await hide.json()).toMatchObject({
        revealed: false,
        sections: [],
        revision: 2,
      })
      const after = await readRevealed(owner)
      const afterText = await after.text()
      expect(JSON.parse(afterText)).toEqual({ revision: 2, sections: [] })
      expect(afterText).not.toContain(SENTINEL)

      // O Histórico do dono: os dois passos, do narrador, sem a edição da nota
      const history = await as(
        ctx,
        owner,
        'GET',
        `/characters/${characterId}/history`
      )
      const historyText = await history.text()
      expect(historyText).not.toContain(SENTINEL)
      const items = (
        JSON.parse(historyText) as {
          items: {
            event?: string
            byRole: string
            reversible: boolean
            changes: { label: string }[]
          }[]
        }
      ).items
      const steps = items.filter(i => i.event?.startsWith('section.'))
      expect(steps.map(i => i.event)).toEqual([
        'section.hidden',
        'section.revealed',
      ])
      for (const step of steps) {
        expect(step.byRole).toBe('storyteller')
        expect(step.reversible).toBe(false)
        expect(step.changes).toEqual([])
      }
      const notesLabel = (
        await ctx.db
          .selectFrom('trait_templates')
          .select('template_data')
          .executeTakeFirstOrThrow()
      ).template_data as { fields: Record<string, { label: string }> }
      const label = notesLabel.fields[s.notesField]?.label ?? '?'
      for (const item of items)
        for (const change of item.changes) expect(change.label).not.toBe(label)

      // Bastidores: as duas ações, sem detalhe nem texto; o registro guarda
      // só o id da seção
      const backstage = await as(
        ctx,
        storyteller,
        'GET',
        `/chronicles/${chronicleId}/history`
      )
      const backstageText = await backstage.text()
      expect(backstageText).not.toContain(SENTINEL)
      const actions = (
        JSON.parse(backstageText) as {
          items: { action: string; detail: Record<string, unknown> }[]
        }
      ).items.filter(i => i.action.startsWith('character.section.'))
      expect(actions).toEqual([
        expect.objectContaining({
          action: 'character.section.hide',
          detail: {},
        }),
        expect.objectContaining({
          action: 'character.section.reveal',
          detail: {},
        }),
      ])
      const payloads = await ctx.db
        .selectFrom('chronicle_audit')
        .select('payload')
        .where('action', 'in', [
          'character.section.reveal',
          'character.section.hide',
        ])
        .execute()
      for (const p of payloads)
        expect(p.payload).toEqual({ section: s.revealSection })
    })

    it('nenhuma saída de hoje leva a nota revelada ao dono', async () => {
      expect((await reveal(s)).status).toBe(200)
      const outputs = [
        await as(ctx, owner, 'GET', `/characters/${characterId}`),
        await as(ctx, owner, 'GET', `/chronicles/${chronicleId}/characters`),
        await as(ctx, owner, 'GET', `/chronicles/${chronicleId}/table`),
        await as(ctx, owner, 'GET', `/characters/${characterId}/history`),
        // Lote aceito
        await as(ctx, owner, 'POST', `/characters/${characterId}/events`, {
          clientBatchId: crypto.randomUUID(),
          events: [{ path: `values.${s.textField}`, from: null, to: 'novo' }],
        }),
        // Lote recusado por conflito (409 devolve a ficha atual)
        await as(ctx, owner, 'POST', `/characters/${characterId}/events`, {
          clientBatchId: crypto.randomUUID(),
          events: [
            { path: `values.${s.textField}`, from: 'velho', to: 'outro' },
          ],
        }),
        // Rolagem
        await as(ctx, owner, 'POST', `/characters/${characterId}/rolls`, {
          clientRollId: crypto.randomUUID(),
          slots: s.slots,
          difficulty: 6,
        }),
        await as(ctx, owner, 'GET', `/characters/${characterId}/rolls`),
      ]
      expect(outputs.map(r => r.status)).toEqual([
        200, 200, 404, 200, 200, 409, 201, 200,
      ])
      for (const res of outputs)
        expect(await res.text()).not.toContain(SENTINEL)
    })

    it('AuthZ: outro jogador, outro narrador, viewer, NPC e o próprio narrador', async () => {
      // Outro jogador e narrador de outra crônica: 404 nas duas rotas
      for (const user of [player, otherStoryteller]) {
        expect((await reveal(s, {}, user)).status).toBe(404)
        expect((await readRevealed(user)).status).toBe(404)
      }
      // O dono não revela: 403
      const self = await reveal(s, {}, owner)
      expect(self.status).toBe(403)
      expect(await self.json()).toMatchObject({ code: 'STORYTELLER_REQUIRED' })
      // Seção não revelável (pública ou desconhecida): 422
      for (const section of ['about', 'naoExiste']) {
        const res = await reveal(s, { section })
        expect(res.status).toBe(422)
        expect(await res.json()).toMatchObject({ code: 'REVEAL_UNAVAILABLE' })
      }
      // Corpo fora do formato: 400 da validação, antes de tocar o banco
      expect((await reveal(s, { section: "x'; drop" })).status).toBe(400)
      expect((await reveal(s, { section: 'a'.repeat(65) })).status).toBe(400)

      // NPC oculto: o jogador recebe 404 igual a id inexistente; o
      // narrador, 422; ninguém lê pela rota
      const hidden = await makeNpc('hidden')
      await writeNotes(s, hidden)
      const missing = crypto.randomUUID()
      expect((await reveal(s, {}, player, hidden)).status).toBe(404)
      expect((await reveal(s, {}, player, missing)).status).toBe(404)
      expect((await reveal(s, {}, storyteller, hidden)).status).toBe(422)
      expect((await readRevealed(storyteller, hidden)).status).toBe(404)
      expect((await readRevealed(player, hidden)).status).toBe(404)

      // NPC com ficha revelada: o viewer não revela nem lê
      const full = await makeNpc('full')
      await writeNotes(s, full)
      const viewerReveal = await reveal(s, {}, player, full)
      expect(viewerReveal.status).toBe(404)
      const viewerRead = await readRevealed(player, full)
      expect(viewerRead.status).toBe(404)
      expect(await viewerRead.text()).not.toContain(SENTINEL)

      // A ficha do próprio narrador: 422
      const own = await createCharacter(ctx, storyteller, chronicleId, {
        name: 'Ficha da narradora',
      })
      expect((await reveal(s, {}, storyteller, own)).status).toBe(422)
    })

    const stateOf = async () =>
      (
        (await (
          await as(ctx, owner, 'GET', `/characters/${characterId}`)
        ).json()) as {
          member: boolean
          reveal: { sections: string[]; revision: number }
        }
      ).reveal

    it('o ex-membro deixa de ler e, de volta, não lê até o narrador revelar de novo', async () => {
      expect((await reveal(s)).status).toBe(200)
      // Sai pela rota (a saída voluntária)
      const left = await as(
        ctx,
        owner,
        'DELETE',
        `/chronicles/${chronicleId}/members/me`
      )
      expect(left.status).toBe(204)
      const read = await readRevealed(owner)
      expect(read.status).toBe(404)
      expect(await read.text()).not.toContain(SENTINEL)
      const sheet = await as(ctx, owner, 'GET', `/characters/${characterId}`)
      const body = (await sheet.json()) as {
        member: boolean
        reveal: { sections: string[] }
      }
      expect(body.member).toBe(false)
      expect(body.reveal.sections).toEqual([])
      expect(JSON.stringify(body)).not.toContain(SENTINEL)
      // A saída zera a revelação e sobe a revisão
      const row = await ctx.db
        .selectFrom('characters')
        .select(['revealed_sections', 'reveal_revision'])
        .where('id', '=', characterId)
        .executeTakeFirstOrThrow()
      expect(row).toEqual({ revealed_sections: [], reveal_revision: 2 })
      // De volta à crônica (um convite novo): nada revelado, nem o que o
      // narrador escreveu enquanto ela estava fora
      await addMember(ctx, chronicleId, owner)
      const back = await readRevealed(owner)
      expect(back.status).toBe(200)
      expect(await back.json()).toEqual({ revision: 2, sections: [] })
      expect(await stateOf()).toEqual({ sections: [], revision: 2 })
      // A revelação de antes, com a revisão velha, não volta
      expect((await reveal(s, { revision: 1 })).status).toBe(409)
      expect((await reveal(s, { revision: 2 })).status).toBe(200)
      expect(
        JSON.stringify(await (await readRevealed(owner)).json())
      ).toContain(SENTINEL)
    })

    it('o dono removido pelo narrador também perde a revelação', async () => {
      expect((await reveal(s)).status).toBe(200)
      const removed = await as(
        ctx,
        storyteller,
        'DELETE',
        `/chronicles/${chronicleId}/members/${owner.id}`,
        { revokeInvites: false }
      )
      expect(removed.status).toBe(204)
      await addMember(ctx, chronicleId, owner)
      expect(await (await readRevealed(owner)).json()).toEqual({
        revision: 2,
        sections: [],
      })
    })

    it('depois da transferência, o dono não lê até o novo narrador revelar', async () => {
      expect((await reveal(s)).status).toBe(200)
      const proposed = await as(
        ctx,
        storyteller,
        'POST',
        `/chronicles/${chronicleId}/transfer`,
        { clientCommandId: crypto.randomUUID(), recipientId: player.id }
      )
      expect(proposed.status).toBe(201)
      const transfer = (await proposed.json()) as { id: string }
      const accepted = await as(
        ctx,
        player,
        'POST',
        `/chronicles/${chronicleId}/transfer/${transfer.id}/accept`,
        { clientCommandId: crypto.randomUUID() }
      )
      expect(accepted.status).toBe(200)
      // O novo narrador não herda a revelação que não fez
      const read = await readRevealed(owner)
      expect(read.status).toBe(200)
      expect(await read.json()).toEqual({ revision: 2, sections: [] })
      expect(await stateOf()).toEqual({ sections: [], revision: 2 })
      // A narradora antiga perde tudo o que era de narrador
      expect((await readRevealed(storyteller)).status).toBe(404)
      expect((await reveal(s, { revealed: false, revision: 2 })).status).toBe(
        404
      )
      // O novo narrador revela: aí o dono lê
      expect((await reveal(s, { revision: 2 }, player)).status).toBe(200)
      expect(
        JSON.stringify(await (await readRevealed(owner)).json())
      ).toContain(SENTINEL)
    })

    it('comando: reenvio, chave com outro corpo, revisão velha e pedido sem mudança', async () => {
      const before = await ctx.db
        .selectFrom('characters')
        .select(['sheet_version', 'updated_at'])
        .where('id', '=', characterId)
        .executeTakeFirstOrThrow()
      const key = crypto.randomUUID()
      const first = (await (
        await reveal(s, { clientCommandId: key })
      ).json()) as Reveal
      expect(first).toMatchObject({ revision: 1, duplicate: false })
      const again = (await (
        await reveal(s, { clientCommandId: key })
      ).json()) as Reveal
      expect(again).toEqual({ ...first, duplicate: true })
      const other = await reveal(s, { clientCommandId: key, revealed: false })
      expect(other.status).toBe(409)
      expect(await other.json()).toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
      // Revisão velha (inclusive do cache): 409 com a atual
      const stale = await reveal(s, { revealed: false, revision: 0 })
      expect(stale.status).toBe(409)
      expect(await stale.json()).toMatchObject({
        code: 'REVISION_CONFLICT',
        revision: 1,
      })
      // Revelar o já revelado: o estado atual, sem subir a revisão nem
      // registrar
      const same = (await (await reveal(s, { revision: 1 })).json()) as Reveal
      expect(same).toMatchObject({ revision: 1, sections: [s.revealSection] })
      const audits = await ctx.db
        .selectFrom('chronicle_audit')
        .select('action')
        .where('action', '=', 'character.section.reveal')
        .execute()
      expect(audits).toHaveLength(1)
      // Revelar não é edição da ficha
      const after = await ctx.db
        .selectFrom('characters')
        .select(['sheet_version', 'updated_at', 'revealed_sections'])
        .where('id', '=', characterId)
        .executeTakeFirstOrThrow()
      expect(after.sheet_version).toBe(before.sheet_version)
      expect(String(after.updated_at)).toBe(String(before.updated_at))
      expect(after.revealed_sections).toEqual([s.revealSection])
    })

    it('com 8 ids fora do modelo gravados, revelar dá 200 e guarda só a seção válida', async () => {
      // Dado antigo ou adulterado: 8 ids, o máximo do CHECK. Antes, a
      // próxima revelação somava o nono e o banco recusava (500)
      await ctx.db
        .updateTable('characters')
        .set({
          revealed_sections: Array.from({ length: 8 }, (_, i) => `velha${i}`),
        })
        .where('id', '=', characterId)
        .execute()
      const res = await reveal(s)
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({
        sections: [s.revealSection],
        revision: 1,
      })
      const row = await ctx.db
        .selectFrom('characters')
        .select('revealed_sections')
        .where('id', '=', characterId)
        .executeTakeFirstOrThrow()
      expect(row.revealed_sections).toEqual([s.revealSection])
    })

    it('id de seção que o modelo deixou de revelar não abre nada', async () => {
      // Um valor gravado fora da rota (dado legado ou adulterado) é ignorado
      await ctx.db
        .updateTable('characters')
        .set({ revealed_sections: ['about', 'naoExiste'] })
        .where('id', '=', characterId)
        .execute()
      expect(await (await readRevealed(owner)).json()).toEqual({
        revision: 0,
        sections: [],
      })
      const sheet = (await (
        await as(ctx, owner, 'GET', `/characters/${characterId}`)
      ).json()) as { reveal: { sections: string[] } }
      expect(sheet.reveal.sections).toEqual([])
    })
  })
}

// U-11: o servidor só revela seção do layout `text` (o único com o bloco de
// leitura do dono e o controle do narrador), pela mesma regra do core
describe('revealedOf: só seções reveláveis do modelo', () => {
  it('seção restrita de texto com outro layout não é revelada', () => {
    const t = template('vtm-v20') as {
      fields: Record<string, unknown>
      sections: Record<string, unknown>[]
    }
    t.fields.secretFact = { type: 'text', label: 'Segredo', maxLength: 80 }
    t.sections.push({
      id: 'facts',
      zone: 'lore',
      title: 'Fatos',
      layout: 'fields',
      fields: ['secretFact'],
      permissions: { read: ['storyteller'], write: ['storyteller'] },
    })
    const model = compileTemplate(t)
    expect(revealedOf(model, ['facts', 'storyteller'])).toEqual(['storyteller'])
    expect(
      revealedValues(
        model,
        { values: { secretFact: 'x', storytellerNotes: 'y' } },
        ['owner'],
        revealedOf(model, ['facts'])
      )
    ).toEqual([])
  })
})

// O modelo da ficha é lido na transação da rota (`trx`), não noutra conexão
// do pool, que ficaria presa enquanto a linha da ficha está travada. Com o
// cache de modelos frio (versão publicada agora, ficha criada no banco),
// revelar é a primeira leitura dele. O PGLite deste arquivo não reproduz a
// espera (o teste passa também com `db`): ele fixa o caminho frio, e a
// concorrência em Postgres real fica no backstage.pg.test.ts
describe('revelar com o cache de modelos frio', () => {
  beforeEach(async () => {
    await destroyTestDb()
    ctx = await createTestContext()
  })
  afterEach(async () => destroyTestDb())

  it('a primeira leitura do modelo é a da rota de revelar', async () => {
    const t = template('vtm-v20')
    t.templateVersion = `9.${Date.now() % 100000}.0`
    await publishTemplate(ctx.db, t)
    storyteller = await createUser(ctx, 'narradora-frio')
    owner = await createUser(ctx, 'dona-frio')
    chronicleId = await createChronicle(ctx, storyteller)
    await addMember(ctx, chronicleId, owner)
    characterId = await createCharacter(ctx, owner, chronicleId)
    const res = await as(
      ctx,
      storyteller,
      'POST',
      `/characters/${characterId}/reveal`,
      {
        clientCommandId: crypto.randomUUID(),
        section: 'storyteller',
        revealed: true,
        revision: 0,
      }
    )
    expect(res.status).toBe(200)
  }, 10_000)
})
