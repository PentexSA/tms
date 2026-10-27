import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { apiAs, freeCreation, rawAs, signUp } from '../support/users'

const PASSWORD = 'correct horse battery staple'
const NPC = 'Oráculo Velado'
const PRIVATE = 'SENTINELA-PRIVADA-NAO-PODE-VAZAR'

test('a jornada da v5: bastidores privados, revelação e transferência', async ({
  browser,
  page,
}) => {
  test.setTimeout(240_000)
  const storytellerContext = page.context()
  const playerAContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const playerBContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const formerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })

  try {
    const storyteller = await signUp(storytellerContext, 'backstage_narra')
    const playerA = await signUp(playerAContext, 'backstage_a')
    const playerB = await signUp(playerBContext, 'backstage_b')
    const former = await signUp(formerContext, 'backstage_former')
    const playerPage = await playerAContext.newPage()

    const chronicle = await apiAs<{ id: string }>(
      storytellerContext,
      storyteller,
      'POST',
      '/chronicles',
      { name: 'Crônica dos Bastidores', systemCode: 'vtm-v20' }
    )
    await freeCreation(storytellerContext, storyteller, chronicle.id)
    const invite = await apiAs<{ code: string }>(
      storytellerContext,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/invites`,
      { maxUses: 3 }
    )
    for (const [context, user] of [
      [playerAContext, playerA],
      [playerBContext, playerB],
      [formerContext, former],
    ] as const)
      await apiAs(context, user, 'POST', '/invites/accept', {
        code: invite.code,
      })

    const playerCharacter = await apiAs<{ id: string }>(
      playerAContext,
      playerA,
      'POST',
      `/chronicles/${chronicle.id}/characters`,
      { values: { name: 'Helena dos Bastidores' } }
    )
    await apiAs(
      storytellerContext,
      storyteller,
      'POST',
      `/characters/${playerCharacter.id}/events`,
      {
        clientBatchId: randomUUID(),
        events: [
          { path: 'values.dexterity', from: null, to: 3 },
          { path: 'values.athletics', from: null, to: 2 },
          {
            path: 'values.willpower',
            from: null,
            to: { current: 5, permanent: 7 },
          },
        ],
      }
    )
    const formerCharacter = await apiAs<{ id: string }>(
      formerContext,
      former,
      'POST',
      `/chronicles/${chronicle.id}/characters`,
      { values: { name: 'Memória Arquivada' } }
    )
    expect(
      (
        await rawAs(
          formerContext,
          former,
          'DELETE',
          `/chronicles/${chronicle.id}/members/me`
        )
      ).status()
    ).toBe(204)

    // O NPC nasce pela interface do narrador, oculto e em criação livre.
    await page.goto(`/chronicles/${chronicle.id}`)
    await page.getByRole('button', { name: 'Criar NPC' }).click()
    await expect(page.getByRole('heading', { name: 'Novo NPC' })).toBeVisible()
    await page.getByLabel('Nome (obrigatório)').fill(NPC)
    await page.getByRole('radio', { name: 'Tremere' }).click()
    await page.getByRole('button', { name: 'Criar ficha' }).click()
    await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}/)
    const npcId = /characters\/([0-9a-f-]{36})/.exec(page.url())![1]!
    await expect(page.getByText('Visibilidade do NPC')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Oculto' })).toBeDisabled()

    await apiAs(
      storytellerContext,
      storyteller,
      'POST',
      `/characters/${npcId}/events`,
      {
        clientBatchId: randomUUID(),
        events: [
          { path: 'values.storytellerNotes', from: null, to: PRIVATE },
          { path: 'values.dexterity', from: null, to: 4 },
        ],
      }
    )
    await apiAs(
      storytellerContext,
      storyteller,
      'POST',
      `/characters/${npcId}/creation/complete`,
      { clientCommandId: randomUUID(), revision: 0, sheetVersion: 1 }
    )

    const hiddenList = await apiAs<unknown[]>(
      playerAContext,
      playerA,
      'GET',
      `/chronicles/${chronicle.id}/characters`
    )
    expect(JSON.stringify(hiddenList)).not.toContain(NPC)
    expect(JSON.stringify(hiddenList)).not.toContain(PRIVATE)
    expect(
      (
        await rawAs(playerAContext, playerA, 'GET', `/characters/${npcId}`)
      ).status()
    ).toBe(404)
    const beforeReveal = await apiAs<{ id: string; characterCount: number }[]>(
      playerAContext,
      playerA,
      'GET',
      '/chronicles'
    )
    expect(
      beforeReveal.find(item => item.id === chronicle.id)?.characterCount
    ).toBe(1)

    // Uma rolagem oculta com custo não aparece nem como roll nem como lote.
    const historyBefore = await apiAs<{ items: unknown[] }>(
      playerAContext,
      playerA,
      'GET',
      `/characters/${playerCharacter.id}/history`
    )
    await apiAs(
      storytellerContext,
      storyteller,
      'POST',
      `/characters/${playerCharacter.id}/rolls`,
      {
        clientRollId: randomUUID(),
        slots: { attribute: 'dexterity', ability: 'athletics' },
        difficulty: 6,
        boosts: ['willpower'],
        hidden: true,
      }
    )
    const ownerRolls = await apiAs<{ items: unknown[] }>(
      playerAContext,
      playerA,
      'GET',
      `/characters/${playerCharacter.id}/rolls`
    )
    const historyAfter = await apiAs<{ items: unknown[] }>(
      playerAContext,
      playerA,
      'GET',
      `/characters/${playerCharacter.id}/history`
    )
    expect(ownerRolls.items).toEqual([])
    expect(historyAfter.items).toEqual(historyBefore.items)

    const freeKey = randomUUID()
    const freeIntent = {
      clientRollId: freeKey,
      dice: 3,
      difficulty: 6,
      specialty: false,
      label: 'Presságio secreto',
    }
    const free = await apiAs<{ duplicate: boolean; roll: { id: string } }>(
      storytellerContext,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/rolls`,
      freeIntent
    )
    const replay = await apiAs<{ duplicate: boolean; roll: { id: string } }>(
      storytellerContext,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/rolls`,
      freeIntent
    )
    expect(replay).toMatchObject({
      duplicate: true,
      roll: { id: free.roll.id },
    })
    expect(
      (
        await rawAs(
          playerAContext,
          playerA,
          'GET',
          `/chronicles/${chronicle.id}/rolls`
        )
      ).status()
    ).toBe(404)
    const feed = await apiAs<{ items: { label: string }[] }>(
      storytellerContext,
      storyteller,
      'GET',
      `/chronicles/${chronicle.id}/rolls`
    )
    expect(feed.items.map(item => item.label)).toContain('Presságio secreto')

    // Identidade é uma allowlist; a tela não constrói a ficha completa.
    await apiAs(
      storytellerContext,
      storyteller,
      'POST',
      `/characters/${npcId}/visibility`,
      {
        clientCommandId: randomUUID(),
        visibility: 'identity',
        revision: 0,
      }
    )
    const identity = await apiAs<Record<string, unknown>>(
      playerAContext,
      playerA,
      'GET',
      `/characters/${npcId}`
    )
    expect(Object.keys(identity).sort()).toEqual(
      ['id', 'identity', 'kind', 'projection', 'visibility'].sort()
    )
    expect(identity).toMatchObject({
      id: npcId,
      kind: 'npc',
      projection: 'identity',
      visibility: 'identity',
      identity: { name: NPC },
    })
    expect(JSON.stringify(identity)).not.toContain(PRIVATE)
    expect(JSON.stringify(identity)).not.toContain('values')
    const revealed = await apiAs<unknown[]>(
      playerAContext,
      playerA,
      'GET',
      `/chronicles/${chronicle.id}/characters`
    )
    expect(JSON.stringify(revealed)).toContain(NPC)
    expect(JSON.stringify(revealed)).not.toContain(PRIVATE)
    await playerPage.goto(`/chronicles/${chronicle.id}`)
    await playerPage.getByText(NPC, { exact: true }).click()
    await expect(
      playerPage.getByText('O narrador revelou apenas a identidade.')
    ).toBeVisible()

    // Em full, viewer recebe a ficha filtrada e nenhuma ação lateral.
    await apiAs(
      storytellerContext,
      storyteller,
      'POST',
      `/characters/${npcId}/visibility`,
      {
        clientCommandId: randomUUID(),
        visibility: 'full',
        revision: 1,
      }
    )
    await playerPage.reload()
    await expect(playerPage.getByText('Leitura', { exact: true })).toBeVisible()
    await expect(playerPage.getByText(PRIVATE)).toHaveCount(0)
    await expect(
      playerPage.getByRole('button', { name: 'Dados', exact: true })
    ).toHaveCount(0)
    await expect(
      playerPage.getByRole('button', { name: 'Histórico', exact: true })
    ).toHaveCount(0)
    await expect(
      playerPage.getByRole('button', { name: 'Experiência', exact: true })
    ).toHaveCount(0)
    for (const path of ['/rolls', '/history', '/creation', '/xp-ledger'])
      expect(
        (
          await rawAs(
            playerAContext,
            playerA,
            'GET',
            `/characters/${npcId}${path}`
          )
        ).status()
      ).toBe(404)

    // O diário separa o resumo público da nota privada.
    await apiAs(
      storytellerContext,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/sessions`,
      {
        clientCommandId: randomUUID(),
        date: '2026-10-23',
        title: 'A noite do oráculo',
        summary: 'A coterie encontrou uma pista.',
        privateNotes: PRIVATE,
      }
    )
    const publicSessions = await apiAs<{ items: unknown[] }>(
      playerAContext,
      playerA,
      'GET',
      `/chronicles/${chronicle.id}/sessions`
    )
    expect(JSON.stringify(publicSessions)).toContain('A noite do oráculo')
    expect(JSON.stringify(publicSessions)).not.toContain(PRIVATE)
    await apiAs(
      storytellerContext,
      storyteller,
      'PATCH',
      `/chronicles/${chronicle.id}`,
      {
        clientCommandId: randomUUID(),
        revision: 0,
        name: 'Crônica Revelada',
        description: 'Uma campanha sobre segredos.',
        imageUrl: null,
        options: {},
      }
    )
    const audit = await apiAs<{ items: unknown[] }>(
      storytellerContext,
      storyteller,
      'GET',
      `/chronicles/${chronicle.id}/history?limit=5`
    )
    expect(audit.items.length).toBeGreaterThan(0)
    expect(JSON.stringify(audit)).not.toContain(PRIVATE)
    await page.goto(`/chronicles/${chronicle.id}`)
    await page.getByRole('tab', { name: 'Mesa' }).click()
    await expect(page.getByText('Presságio secreto')).toBeVisible()
    await page.getByRole('tab', { name: 'Bastidores' }).click()
    await expect(page.getByText('A noite do oráculo')).toBeVisible()
    await expect(page.getByText('Auditoria')).toBeVisible()

    // Reduzir a visibilidade revoga novas leituras e a projeção em cache.
    await apiAs(
      storytellerContext,
      storyteller,
      'POST',
      `/characters/${npcId}/visibility`,
      {
        clientCommandId: randomUUID(),
        visibility: 'hidden',
        revision: 2,
      }
    )
    await playerPage.reload()
    await expect(
      playerPage.getByRole('heading', {
        name: 'Você não tem acesso a esta ficha',
      })
    ).toBeVisible()
    await playerPage.goto(`/chronicles/${chronicle.id}`)
    await expect(playerPage.getByText(NPC, { exact: true })).toHaveCount(0)
    const afterHide = await apiAs<{ id: string; characterCount: number }[]>(
      playerAContext,
      playerA,
      'GET',
      '/chronicles'
    )
    expect(
      afterHide.find(item => item.id === chronicle.id)?.characterCount
    ).toBe(1)

    // Outro jogador não abre o PC; ex-membro mantém só o próprio PC.
    expect(
      (
        await rawAs(
          playerBContext,
          playerB,
          'GET',
          `/characters/${playerCharacter.id}`
        )
      ).status()
    ).toBe(404)
    expect(
      (
        await rawAs(formerContext, former, 'GET', `/characters/${npcId}`)
      ).status()
    ).toBe(404)
    const formerList = await apiAs<{ id: string }[]>(
      formerContext,
      former,
      'GET',
      `/chronicles/${chronicle.id}/characters`
    )
    expect(formerList.map(item => item.id)).toEqual([formerCharacter.id])
    expect(
      (
        await rawAs(
          formerContext,
          former,
          'GET',
          `/characters/${formerCharacter.id}`
        )
      ).status()
    ).toBe(200)

    // A transferência troca a autoridade, move NPCs e permite apagar a conta
    // antiga sem apagar o NPC transferido.
    const detail = await apiAs<{
      members: { id: string; username: string }[]
    }>(storytellerContext, storyteller, 'GET', `/chronicles/${chronicle.id}`)
    const recipientId = detail.members.find(
      member => member.username === playerB.username
    )!.id
    const transfer = await apiAs<{ id: string }>(
      storytellerContext,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/transfer`,
      { clientCommandId: randomUUID(), recipientId }
    )
    await apiAs(
      playerBContext,
      playerB,
      'POST',
      `/chronicles/${chronicle.id}/transfer/${transfer.id}/accept`,
      { clientCommandId: randomUUID() }
    )
    expect(
      (
        await rawAs(
          storytellerContext,
          storyteller,
          'GET',
          `/chronicles/${chronicle.id}/history`
        )
      ).status()
    ).toBe(404)
    expect(
      (
        await rawAs(
          storytellerContext,
          storyteller,
          'GET',
          `/chronicles/${chronicle.id}/rolls`
        )
      ).status()
    ).toBe(404)
    const movedNpc = await apiAs<{
      id: string
      owner: { id: string }
      roles: string[]
    }>(playerBContext, playerB, 'GET', `/characters/${npcId}`)
    expect(movedNpc).toMatchObject({
      id: npcId,
      owner: { id: recipientId },
      roles: expect.arrayContaining(['storyteller']),
    })
    expect(
      (
        await rawAs(storytellerContext, storyteller, 'DELETE', '/me', {
          password: PASSWORD,
        })
      ).status()
    ).toBe(204)
    expect(
      (
        await rawAs(playerBContext, playerB, 'GET', `/characters/${npcId}`)
      ).status()
    ).toBe(200)
  } finally {
    await playerAContext.close().catch(() => undefined)
    await playerBContext.close().catch(() => undefined)
    await formerContext.close().catch(() => undefined)
  }
})
