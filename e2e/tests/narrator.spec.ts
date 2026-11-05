import { randomUUID } from 'node:crypto'
import { type Browser, expect, type Page, test } from '@playwright/test'
import { apiAs, completeCreation, freeCreation, signUp } from '../support/users'

// P09-C: o narrador revisa em Leitura e a Mesa cabe na tela. O que o Jest não
// pega no web: os papéis e o aria-live no DOM, a aba na URL depois do
// setParams, a volta pela pilha (o Expo Router no web), a barra fora da
// rolagem e a grade. Contas e fichas fictícias, pela API.

type User = Awaited<ReturnType<typeof signUp>>

/** Narrador com uma crônica de Vampiro e uma jogadora que entrou. */
async function table(
  browser: Browser,
  page: Page,
  options: { readonly free?: boolean } = {}
) {
  const desk = page.context()
  const storyteller = await signUp(desk, 'narra_p09')
  const chronicle = await apiAs<{ id: string }>(
    desk,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica da Mesa', systemCode: 'vtm-v20' }
  )
  if (options.free) await freeCreation(desk, storyteller, chronicle.id)
  const { code } = await apiAs<{ code: string }>(
    desk,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`
  )
  const playerContext = await browser.newContext()
  const player = await signUp(playerContext, 'joga_p09')
  await apiAs(playerContext, player, 'POST', '/invites/accept', { code })
  return { desk, storyteller, chronicleId: chronicle.id, playerContext, player }
}

const sheetOf = (
  context: Awaited<ReturnType<typeof table>>['playerContext'],
  player: User,
  chronicleId: string,
  name: string
) =>
  apiAs<{ id: string }>(
    context,
    player,
    'POST',
    `/chronicles/${chronicleId}/characters`,
    { values: { name, clan: 'tremere' } }
  )

test.describe('a 390', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // T-33 e R-09: Leitura com a conta; editar só pelo botão; notas privadas
  test('o narrador revisa a ficha em criação por pontos sem editar', async ({
    browser,
    page,
  }) => {
    const { chronicleId, playerContext, player } = await table(browser, page)
    const { id } = await sheetOf(
      playerContext,
      player,
      chronicleId,
      'Isadora Vex'
    )
    // Nenhum lote sai da Leitura
    const batches: string[] = []
    page.on('request', r => {
      if (r.method() === 'POST' && r.url().endsWith(`/characters/${id}/events`))
        batches.push(r.url())
    })
    await page.goto(`/characters/${id}`)
    await expect(page.getByText(`Ficha de ${player.username}.`)).toBeVisible()
    await expect(
      page.getByRole('radiogroup', { name: 'Modo da ficha' })
    ).toHaveCount(0)
    // A conta, em Leitura: a aba Pontos, sem as "Regras da casa"
    await expect(
      page.getByRole('tablist', { name: 'Partes da ficha' })
    ).toBeVisible()
    const budget = page.getByRole('tab', { name: 'Pontos', exact: true })
    await budget.scrollIntoViewIfNeeded()
    await budget.click()
    await expect(page.getByTestId('creation-freebies')).toBeVisible()
    await expect(page.getByText('Regras da casa')).toHaveCount(0)
    // As Notas do Narrador dizem que são privadas
    const about = page.getByRole('tab', { name: 'Sobre' })
    await about.scrollIntoViewIfNeeded()
    await about.click()
    await expect(
      page.getByText('Notas do Narrador · privadas: o jogador não vê')
    ).toBeVisible()
    expect(batches).toEqual([])

    // "Editar como narrador" abre a Criação de fato
    await page.getByRole('button', { name: 'Editar como narrador' }).click()
    await expect(
      page.getByRole('radio', { name: 'Criação', exact: true })
    ).toBeChecked()
    await expect(
      page.getByText('As alterações ficam assinadas no histórico.')
    ).toBeVisible()
    // R-09: o aviso no nome do botão e na descrição do campo (no DOM)
    const editNotes = page.getByRole('button', {
      name: 'Editar Notas do Narrador',
    })
    await expect(editNotes).toHaveAccessibleName(
      'Editar Notas do Narrador. Privadas: o jogador não vê'
    )
    await editNotes.click()
    await expect(
      page.getByText('Privadas: o jogador não vê estas notas.')
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Notas do Narrador', exact: true })
    ).toHaveAccessibleDescription('Privadas: o jogador não vê estas notas.')
    await expect(
      page.getByText(
        "Para pedir uma correção ao jogador, use 'Pedir ajuste' em Ações do narrador."
      )
    ).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    // Sem alterações, volta direto à Leitura
    await page.getByRole('button', { name: 'Voltar à leitura' }).click()
    await expect(page.getByText(`Ficha de ${player.username}.`)).toBeVisible()
    await expect(
      page.getByRole('radiogroup', { name: 'Modo da ficha' })
    ).toHaveCount(0)
    expect(batches).toEqual([])
    await playerContext.close()
  })

  // T-48, T-39 e T-49: cartão compacto, a volta à mesma aba e ponto, e a
  // barra da seleção à vista
  test('Mesa com 8 fichas: cartão, volta ao ponto e barra fixa', async ({
    browser,
    page,
  }) => {
    const { desk, storyteller, chronicleId, playerContext, player } =
      await table(browser, page, { free: true })
    const ids: string[] = []
    for (let i = 1; i <= 8; i++)
      ids.push(
        (await sheetOf(playerContext, player, chronicleId, `Ficha ${i}`)).id
      )
    const last = ids.at(-1) as string
    // Um NPC oculto: o selo de visibilidade e o de estado na mesma linha
    const npc = await apiAs<{ id: string }>(
      desk,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      {
        kind: 'npc',
        clientCommandId: randomUUID(),
        values: { name: 'Sentinela', clan: 'tremere' },
      }
    )
    await page.goto(`/chronicles/${chronicleId}`)
    await page.getByRole('tab', { name: 'Mesa' }).click()
    await expect(page).toHaveURL(/\?view=table$/)
    const first = page.getByTestId(`table-row-${ids[0]}`)
    await expect(first).toBeVisible()
    // T-48: os recursos numa linha, ~5 cartões por tela
    const card = await first.boundingBox()
    expect(card?.height ?? 999).toBeLessThan(170)
    // O NPC, com os dois selos, cabe na largura (a linha pode quebrar)
    const npcRow = page.getByTestId(`table-row-${npc.id}`)
    await npcRow.scrollIntoViewIfNeeded()
    await expect(npcRow).toContainText('Oculto')
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 })
      const box = await npcRow.boundingBox()
      const badges = await page
        .getByTestId(`table-badges-${npc.id}`)
        .boundingBox()
      expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(width)
      expect((badges?.x ?? 0) + (badges?.width ?? 999)).toBeLessThanOrEqual(
        (box?.x ?? 0) + (box?.width ?? 0)
      )
      test.info().annotations.push({
        type: 'altura',
        description: `${width}: PC ${(await first.boundingBox())?.height} · NPC ${box?.height}`,
      })
    }
    await page.setViewportSize({ width: 390, height: 844 })

    // T-39: abrir a última e voltar pelo "‹"
    const row = page.getByTestId(`table-row-${last}`)
    await row.scrollIntoViewIfNeeded()
    await row.click()
    await expect(page).toHaveURL(new RegExp(`/characters/${last}$`))
    await page.getByRole('button', { name: /^Voltar para / }).click()
    await expect(page).toHaveURL(/\?view=table$/)
    await expect(page.getByRole('tab', { name: 'Mesa' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByTestId(`table-row-${last}`)).toBeInViewport()
    // O mesmo pelo voltar do navegador
    await page.getByTestId(`table-row-${last}`).click()
    await expect(page).toHaveURL(new RegExp(`/characters/${last}$`))
    await page.goBack()
    await expect(page).toHaveURL(/\?view=table$/)
    await expect(page.getByRole('tab', { name: 'Mesa' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByTestId(`table-row-${last}`)).toBeInViewport()

    // T-49 e T-75: marcar a última; a barra fica à vista, com a contagem.
    // No web, a seleção não chama o BackHandler (só existe no Android)
    const errors: string[] = []
    page.on('console', m => {
      if (m.type() === 'error') errors.push(m.text())
    })
    await page.getByRole('button', { name: 'Selecionar personagens' }).click()
    const box = page.getByRole('checkbox', { name: `Selecionar Ficha 8` })
    await box.scrollIntoViewIfNeeded()
    await box.click()
    const bar = page.getByRole('toolbar', { name: 'Ações da seleção' })
    await expect(bar.getByText('1 selecionado (máx. 20)')).toBeVisible()
    await expect(bar.getByText('1 selecionado (máx. 20)')).toHaveAttribute(
      'aria-live',
      'polite'
    )
    const fixed = await bar.boundingBox()
    expect((fixed?.y ?? 0) + (fixed?.height ?? 0)).toBeLessThanOrEqual(844)
    await expect(
      bar.getByRole('button', { name: 'Aplicar dano', exact: true })
    ).toBeInViewport()
    // A barra não rola com a Mesa
    await page.getByTestId(`table-row-${ids[0]}`).scrollIntoViewIfNeeded()
    expect(await bar.boundingBox()).toEqual(fixed)
    await bar.getByRole('button', { name: 'Limpar seleção' }).click()
    await expect(bar.getByText('Nenhum selecionado (máx. 20)')).toBeVisible()
    expect(errors.filter(e => e.includes('BackHandler'))).toEqual([])
    await playerContext.close()
  })
})

test.describe('a 1280', () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  // T-48: a grade de 3 colunas, linha a linha
  test('a Mesa em grade de 3 colunas', async ({ browser, page }) => {
    const { chronicleId, playerContext, player } = await table(browser, page, {
      free: true,
    })
    const ids: string[] = []
    for (const name of ['Ficha A', 'Ficha B', 'Ficha C', 'Ficha D'])
      ids.push((await sheetOf(playerContext, player, chronicleId, name)).id)
    await page.goto(`/chronicles/${chronicleId}?view=table`)
    // O link direto abre a aba certa (T-39)
    await expect(page.getByRole('tab', { name: 'Mesa' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    const boxes = []
    for (const id of ids.slice(0, 3)) {
      const row = page.getByTestId(`table-row-${id}`)
      await expect(row).toBeVisible()
      boxes.push(await row.boundingBox())
    }
    const [a, b, c] = boxes
    expect(Math.abs((a?.y ?? 0) - (b?.y ?? 99))).toBeLessThanOrEqual(4)
    expect(Math.abs((a?.y ?? 0) - (c?.y ?? 99))).toBeLessThanOrEqual(4)
    expect(a?.x ?? 0).toBeLessThan(b?.x ?? 0)
    expect(b?.x ?? 0).toBeLessThan(c?.x ?? 0)
    // A quarta vai para a linha de baixo
    const d = await page.getByTestId(`table-row-${ids[3]}`).boundingBox()
    expect(d?.y ?? 0).toBeGreaterThan((a?.y ?? 0) + (a?.height ?? 0))
    await playerContext.close()
  })

  // T-40: o pedido de XP aparece no foco da janela, sem recarregar; aceitar
  // a narração muda a tela sem sair
  test('pedido de XP no foco e aceite da narração sem recarregar', async ({
    browser,
    page,
  }) => {
    const { desk, storyteller, chronicleId, playerContext, player } =
      await table(browser, page, { free: true })
    const { id } = await sheetOf(
      playerContext,
      player,
      chronicleId,
      'Helena Varga'
    )
    await completeCreation(desk, storyteller, id)
    await apiAs(desk, storyteller, 'POST', `/chronicles/${chronicleId}/xp`, {
      clientOperationId: randomUUID(),
      amount: 10,
      reason: 'Sessão 1',
      targets: [{ characterId: id }],
    })
    await page.goto(`/chronicles/${chronicleId}?view=table`)
    await expect(page.getByTestId(`table-row-${id}`)).toBeVisible()
    await expect(page.getByTestId('table-xp-requests')).toHaveCount(0)
    await apiAs(
      playerContext,
      player,
      'POST',
      `/characters/${id}/xp-requests`,
      {
        clientRequestId: randomUUID(),
        field: 'dexterity',
      }
    )
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByTestId('table-xp-requests')).toHaveText(
      'Pedidos de XP (1)'
    )

    // A transferência proposta pela API e aceita pela tela da jogadora
    const detail = await apiAs<{
      members: { id: string; username: string }[]
    }>(desk, storyteller, 'GET', `/chronicles/${chronicleId}`)
    const recipientId = detail.members.find(
      m => m.username === player.username
    )?.id
    await apiAs(
      desk,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/transfer`,
      {
        clientCommandId: randomUUID(),
        recipientId,
      }
    )
    const mine = await playerContext.newPage()
    await mine.goto(`/chronicles/${chronicleId}?view=backstage`)
    await expect(
      mine.getByText(`Narrador: ${storyteller.username}`)
    ).toBeVisible()
    let loads = 0
    mine.on('load', () => {
      loads++
    })
    await mine.getByRole('button', { name: 'Aceitar narração' }).click()
    // O aviso sai com a resposta do aceite; a tela troca quando a crônica
    // volta com o papel novo. Os dois textos se contêm: casa exato
    await expect(
      mine.getByText('Agora você narra esta crônica.', { exact: true })
    ).toBeVisible()
    await expect(
      mine.getByText('Você narra esta crônica.', { exact: true })
    ).toBeVisible()
    await expect(mine.getByRole('tab', { name: 'Mesa' })).toBeVisible()
    expect(loads).toBe(0)
    await playerContext.close()
  })
})
