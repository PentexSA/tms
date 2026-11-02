import { randomUUID } from 'node:crypto'
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test'
import { API_URL, WEB_URL } from '../env'
import { apiAs, completeCreation, freeCreation, signUp } from '../support/users'

// P11 (onda 3): bastidores e NPC no web, a 390 e a 1280, com o fuso de São
// Paulo. Sem o fuso fixo, o CI (UTC) não mostra o dia anterior do T-16; com
// ele, o defeito aparece igual em qualquer máquina. Contas fictícias.

const CHRONICLE = 'Crônica dos Segredos'
const NPC = 'Figura Velada'
const PC = 'Helena das Sombras'
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

const contextAt = (
  browser: Browser,
  viewport: { width: number; height: number }
) =>
  browser.newContext({
    viewport,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })

// A senha fictícia que o signUp do E2E usa (support/users.ts)
const E2E_PASSWORD = 'correct horse battery staple'

/**
 * Uma segunda sessão da mesma conta noutro contexto (outro tamanho de tela).
 * Copiar o cookie do refresh dividiria a mesma família de tokens, e a
 * rotação revogaria uma das duas.
 */
async function signIn(
  context: BrowserContext,
  user: { readonly username: string; readonly ip: string }
) {
  await context.setExtraHTTPHeaders({ 'x-tms-test-client-ip': user.ip })
  const res = await context.request.post(`${API_URL}/auth/login`, {
    data: { email: `${user.username}@example.test`, password: E2E_PASSWORD },
    headers: { origin: WEB_URL, 'x-tms-test-client-ip': user.ip },
  })
  expect(res.ok()).toBe(true)
}

/** Conta os POST de visibilidade que a página manda (T-46). */
function countVisibilityPosts(page: Page) {
  const seen = { n: 0 }
  page.on('request', req => {
    if (
      req.method() === 'POST' &&
      /\/characters\/[^/]+\/visibility$/.test(req.url())
    )
      seen.n++
  })
  return seen
}

test('bastidores e NPC: revelar com confirmação, data civil, selo, proposta e auditoria', async ({
  browser,
}) => {
  test.setTimeout(240_000)
  const contexts: BrowserContext[] = []
  const open = async (viewport: typeof PHONE) => {
    const context = await contextAt(browser, viewport)
    contexts.push(context)
    return context
  }

  try {
    const storytellerPhone = await open(PHONE)
    const storytellerDesk = await open(DESKTOP)
    const playerPhone = await open(PHONE)
    const playerDesk = await open(DESKTOP)
    const otherPhone = await open(PHONE)
    const recipientPhone = await open(PHONE)

    const storyteller = await signUp(storytellerPhone, 'npc_narra')
    const player = await signUp(playerPhone, 'npc_jog')
    const other = await signUp(otherPhone, 'npc_outro')
    const recipient = await signUp(recipientPhone, 'npc_dest')
    // Narrador e jogador também a 1280, cada um com uma sessão própria
    await signIn(storytellerDesk, storyteller)
    await signIn(playerDesk, player)

    const chronicle = await apiAs<{ id: string }>(
      storytellerPhone,
      storyteller,
      'POST',
      '/chronicles',
      { clientCommandId: randomUUID(), name: CHRONICLE, systemCode: 'vtm-v20' }
    )
    await freeCreation(storytellerPhone, storyteller, chronicle.id)
    const invite = await apiAs<{ code: string }>(
      storytellerPhone,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/invites`,
      { maxUses: 5 }
    )
    for (const [context, user] of [
      [playerPhone, player],
      [otherPhone, other],
      [recipientPhone, recipient],
    ] as const)
      await apiAs(context, user, 'POST', '/invites/accept', {
        code: invite.code,
      })
    const pc = await apiAs<{ id: string }>(
      playerPhone,
      player,
      'POST',
      `/chronicles/${chronicle.id}/characters`,
      { values: { name: PC } }
    )
    await completeCreation(storytellerPhone, storyteller, pc.id)
    const npc = await apiAs<{ id: string }>(
      storytellerPhone,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/characters`,
      {
        kind: 'npc',
        clientCommandId: randomUUID(),
        values: { name: NPC, clan: 'tremere' },
      }
    )
    // Regras da criação: aprovação Desligada → Ligada (a frase do T-63)
    await apiAs(
      storytellerPhone,
      storyteller,
      'PATCH',
      `/chronicles/${chronicle.id}/creation-settings`,
      { revision: 1, approval: true }
    )

    const narratorPage = await storytellerPhone.newPage()
    const narratorDesk = await storytellerDesk.newPage()
    const playerPage = await playerPhone.newPage()
    const playerDeskPage = await playerDesk.newPage()
    const otherPage = await otherPhone.newPage()
    const recipientPage = await recipientPhone.newPage()

    await test.step('T-16: a sessão registrada sai como data civil e a edição salva', async () => {
      await narratorPage.goto(`/chronicles/${chronicle.id}`)
      await narratorPage.getByRole('tab', { name: 'Bastidores' }).click()
      await narratorPage.getByLabel('Data', { exact: true }).fill('2026-11-01')
      await narratorPage
        .getByLabel('Título da sessão')
        .fill('Sessão do eclipse')
      await narratorPage
        .getByRole('button', { name: 'Registrar sessão' })
        .click()
      await expect(narratorPage.getByText('01/11/2026')).toBeVisible()
      await expect(narratorPage.getByText(/GMT/)).toHaveCount(0)

      await narratorPage
        .getByRole('button', { name: 'Editar', exact: true })
        .click()
      const saved = narratorPage.waitForResponse(
        res =>
          res.request().method() === 'PATCH' &&
          /\/chronicles\/[^/]+\/sessions\/[^/]+$/.test(res.url())
      )
      await narratorPage.getByRole('button', { name: 'Salvar sessão' }).click()
      expect((await saved).status()).toBe(200)
      await expect(narratorPage.getByText('dados inválidos')).toHaveCount(0)
      await expect(
        narratorPage.getByRole('button', { name: 'Reenviar edição' })
      ).toHaveCount(0)
      await expect(narratorPage.getByText('01/11/2026')).toBeVisible()

      // O jogador, a 1280, vê o mesmo dia no Diário (POW-13)
      await playerDeskPage.goto(`/chronicles/${chronicle.id}`)
      await playerDeskPage.getByRole('tab', { name: 'Diário' }).click()
      await expect(playerDeskPage.getByText('01/11/2026')).toBeVisible()
    })

    await test.step('U-04: a lista de crônicas mostra a última sessão', async () => {
      await playerPage.goto('/')
      await expect(
        playerPage.getByRole('button', {
          name: new RegExp(`^${CHRONICLE},.*Última sessão: 01/11`),
        })
      ).toBeVisible()
    })

    await test.step('T-46: revelar a identidade pede confirmação; Esc não envia', async () => {
      const posts = countVisibilityPosts(narratorPage)
      await narratorPage.goto(`/characters/${npc.id}`)
      const identity = narratorPage.getByRole('radio', { name: /^Identidade/ })
      await expect(
        narratorPage.getByRole('radio', { name: /^Oculto/ })
      ).toBeChecked()
      // Pelo teclado: o clique não foca no WebKit do macOS, e o foco volta
      // ao rádio ao fechar
      await identity.focus()
      await narratorPage.keyboard.press(' ')
      const heading = narratorPage.getByRole('heading', {
        name: 'Revelar a identidade para os jogadores?',
      })
      await expect(heading).toBeVisible()
      expect(posts.n).toBe(0)
      await narratorPage.keyboard.press('Escape')
      await expect(heading).toHaveCount(0)
      expect(posts.n).toBe(0)
      await expect(identity).toBeFocused()
      await expect(
        narratorPage.getByRole('radio', { name: /^Oculto/ })
      ).toBeChecked()

      await identity.click()
      await expect(heading).toBeVisible()
      await narratorPage
        .getByRole('button', { name: 'Revelar identidade' })
        .click()
      await expect(identity).toBeChecked()
      expect(posts.n).toBe(1)
      await expect(
        narratorPage.getByText('Identidade revelada aos jogadores.')
      ).toBeVisible()
    })

    await test.step('T-81: o "‹" do NPC com a identidade revelada volta para a crônica', async () => {
      await otherPage.goto(`/chronicles/${chronicle.id}`)
      await otherPage.getByText(NPC, { exact: true }).click()
      await expect(
        otherPage.getByText('O narrador revelou apenas a identidade.')
      ).toBeVisible()
      await otherPage.getByRole('button', { name: /^Voltar para / }).click()
      await expect(otherPage).toHaveURL(
        new RegExp(`/chronicles/${chronicle.id}$`)
      )
      await expect(otherPage.getByRole('tab', { name: 'Fichas' })).toBeVisible()
    })

    await test.step('T-46 a 1280: a folha da ficha é um diálogo de até 560', async () => {
      await narratorDesk.goto(`/characters/${npc.id}`)
      await narratorDesk.getByRole('radio', { name: /^Ficha/ }).click()
      const dialog = narratorDesk.getByTestId('reveal-npc-sheet')
      await expect(
        narratorDesk.getByRole('heading', {
          name: 'Revelar a ficha para os jogadores?',
        })
      ).toBeVisible()
      // A animação de entrada termina antes de medir
      await expect
        .poll(async () => (await dialog.boundingBox())?.y ?? -1)
        .toBeGreaterThan(0)
      expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(560)
      await narratorDesk.getByRole('button', { name: 'Revelar ficha' }).click()
      await expect(
        narratorDesk.getByText('Ficha revelada aos jogadores, só leitura.')
      ).toBeVisible()
      await expect(
        narratorDesk.getByRole('radio', { name: /^Ficha/ })
      ).toBeChecked()
    })

    await test.step('T-15: a ficha revelada ocupa a tela, com as abas', async () => {
      await playerPage.goto(`/chronicles/${chronicle.id}`)
      await playerPage.getByText(NPC, { exact: true }).click()
      const viewer = playerPage.getByTestId('viewer-sheet')
      await expect(viewer).toBeVisible()
      await expect(
        playerPage.getByText('Leitura', { exact: true })
      ).toBeVisible()
      expect((await viewer.boundingBox())!.height).toBeGreaterThan(400)
      await expect(
        viewer.getByRole('tablist', { name: 'Partes da ficha' })
      ).toBeVisible()
    })

    await test.step('T-52: "NPC" e a visibilidade na lista; seção "NPCs" na Mesa', async () => {
      await narratorDesk.goto(`/chronicles/${chronicle.id}`)
      await expect(
        narratorDesk.getByRole('button', {
          // O selo de visibilidade entra no nome acessível depois do meta
          name: new RegExp(`^${NPC},.*NPC, Ficha revelada$`),
        })
      ).toBeVisible()
      await narratorDesk.getByRole('tab', { name: 'Mesa' }).click()
      await expect(narratorDesk.getByTestId('table-npcs')).toBeVisible()
      const npcRow = narratorDesk.getByTestId(`table-row-${npc.id}`)
      const pcRow = narratorDesk.getByTestId(`table-row-${pc.id}`)
      await expect(npcRow).toHaveAccessibleName(/Ficha revelada/)
      await expect(pcRow).not.toHaveAccessibleName(/revelada|Oculto/)
      // PCs antes, NPCs depois do cabeçalho
      expect((await npcRow.boundingBox())!.y).toBeGreaterThan(
        (await pcRow.boundingBox())!.y
      )

      // O jogador nunca vê a visibilidade
      await playerPage.goto(`/chronicles/${chronicle.id}`)
      await expect(
        playerPage.getByRole('button', {
          name: new RegExp(`^${NPC},.*NPC revelado$`),
        })
      ).toBeVisible()
      await expect(
        playerPage.getByText(/Ficha revelada|Identidade revelada/)
      ).toHaveCount(0)
    })

    await test.step('U-03: a proposta de narrar aparece para quem a recebeu', async () => {
      const detail = await apiAs<{
        members: { id: string; username: string }[]
      }>(storytellerPhone, storyteller, 'GET', `/chronicles/${chronicle.id}`)
      const recipientId = detail.members.find(
        m => m.username === recipient.username
      )!.id
      await apiAs(
        storytellerPhone,
        storyteller,
        'POST',
        `/chronicles/${chronicle.id}/transfer`,
        { clientCommandId: randomUUID(), recipientId }
      )
      const accept = recipientPage.getByRole('button', {
        name: 'Aceitar narração',
      })
      await recipientPage.goto('/')
      await expect(
        recipientPage.getByText(`Convite para narrar ${CHRONICLE}`)
      ).toBeVisible()
      await expect(accept).toHaveCount(1)
      await expect(
        recipientPage.getByRole('button', {
          name: new RegExp(`^${CHRONICLE},.*Convite para narrar$`),
        })
      ).toBeVisible()

      await recipientPage.goto(`/chronicles/${chronicle.id}`)
      await expect(accept).toHaveCount(1)
      await recipientPage.getByRole('tab', { name: 'Diário' }).click()
      await expect(accept).toHaveCount(1)

      // O outro jogador nunca vê a proposta
      await playerPage.goto('/')
      await expect(
        playerPage.getByRole('button', { name: 'Aceitar narração' })
      ).toHaveCount(0)

      await recipientPage.getByRole('button', { name: 'Recusar' }).click()
      await expect(accept).toHaveCount(0)
      await recipientPage.goto('/')
      await expect(
        recipientPage.getByText(`Convite para narrar ${CHRONICLE}`)
      ).toHaveCount(0)
    })

    await test.step('T-63: a auditoria em frases, sem códigos nem o código do convite', async () => {
      await narratorDesk.goto(`/chronicles/${chronicle.id}`)
      await narratorDesk.getByRole('tab', { name: 'Bastidores' }).click()
      await expect(narratorDesk.getByText('Auditoria')).toBeVisible()
      await expect(narratorDesk.getByText('Crônica criada')).toBeVisible()
      await expect(narratorDesk.getByText(/^Convite gerado/)).toBeVisible()
      await expect(
        narratorDesk.getByText(
          'Regras da criação: aprovação Desligada → Ligada'
        )
      ).toBeVisible()
      await expect(
        narratorDesk.getByText(`${NPC}: Identidade revelada → Ficha revelada`)
      ).toBeVisible()
      for (const code of [
        'chronicle.creation.settings',
        'sheet.change',
        'character.create-npc',
        'invite.create',
      ])
        await expect(narratorDesk.getByText(code, { exact: true })).toHaveCount(
          0
        )
      await expect(narratorDesk.getByText(invite.code)).toHaveCount(0)
    })
  } finally {
    for (const context of contexts) await context.close()
  }
})
