import { randomUUID } from 'node:crypto'
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test'
import { apiAs, completeCreation, freeCreation, signUp } from '../support/users'

// P13: a lista de evolução (T-50), o "Enviar pedido" bloqueado com o motivo
// (T-77), o atalho do "Peça ao narrador." (U-01) e o "Digitar" do XP (U-02).
// O que o Jest não pega no web: o rodapé no viewport e o aria-disabled sem
// `disabled` no <button>. Contas e fichas fictícias, pela API.

/** Narradora, jogadora que entrou e uma ficha concluída com `xp` de saldo. */
// Os contextos do jogador abertos pelo sheetWithXp fecham depois de cada
// caso: com um worker só, as páginas abertas (a ficha, as rebuscas) se
// acumulavam no WebKit até o Playwright não ver mais o botão parado (U-02)
const opened: BrowserContext[] = []
test.afterEach(async () => {
  await Promise.all(opened.splice(0).map(c => c.close()))
})

async function sheetWithXp(browser: Browser, page: Page, xp: number) {
  const desk = page.context()
  const storyteller = await signUp(desk, 'narra_p13')
  const chronicle = await apiAs<{ id: string }>(
    desk,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica da Experiência', systemCode: 'vtm-v20' }
  )
  await freeCreation(desk, storyteller, chronicle.id)
  const { code } = await apiAs<{ code: string }>(
    desk,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`
  )
  const playerContext = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 390, height: 844 },
  })
  const player = await signUp(playerContext, 'joga_p13')
  await apiAs(playerContext, player, 'POST', '/invites/accept', { code })
  const { id } = await apiAs<{ id: string }>(
    playerContext,
    player,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Helena Varga', clan: 'tremere' } }
  )
  await completeCreation(desk, storyteller, id)
  await apiAs(desk, storyteller, 'POST', `/chronicles/${chronicle.id}/xp`, {
    clientOperationId: randomUUID(),
    amount: xp,
    reason: 'Sessão 1',
    targets: [{ characterId: id }],
  })
  opened.push(playerContext)
  const playerPage = await playerContext.newPage()
  return { id, playerPage, playerContext, player }
}

const openExperience = async (page: Page) => {
  // A ficha carregada: abaixo de 900, a Experiência fica no "Mais opções"
  // (T-11); o isVisible não espera, então espera o "Histórico", que está
  // sempre no menu ou no cabeçalho, para a dona e para o narrador
  await expect(
    page
      .getByRole('button', { name: 'Mais opções' })
      .or(page.getByRole('button', { name: 'Histórico', exact: true }))
  ).toBeVisible()
  const more = page.getByRole('button', { name: 'Mais opções' })
  if (await more.isVisible()) await more.click()
  await page.getByRole('button', { name: 'Experiência', exact: true }).click()
}

const panel = (page: Page) =>
  page.getByTestId('bottom-sheet-root').locator('[aria-modal="true"]')

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test.describe(`a ${viewport.width}`, () => {
    test.use({ viewport })

    test('a lista agrupada, a busca, o rádio marcado e "Enviar pedido" no rodapé, no viewport (T-50)', async ({
      browser,
      page,
    }) => {
      const { id, playerPage } = await sheetWithXp(browser, page, 20)
      await playerPage.goto(`/characters/${id}`)
      await openExperience(playerPage)
      await playerPage
        .getByRole('button', { name: 'Solicitar evolução', exact: true })
        .click()
      await expect(
        playerPage.getByRole('radiogroup', { name: 'Talentos' })
      ).toBeVisible()
      // Uma opção do fim da lista: o rodapé continua à vista
      await playerPage.getByRole('radio', { name: /^Tecnologia, / }).click()
      const send = panel(playerPage).getByRole('button', {
        name: 'Enviar pedido',
        exact: true,
      })
      await expect(send).toBeInViewport()
      await playerPage.getByLabel('Buscar traço').fill('brig')
      const brawl = playerPage.getByRole('radio', { name: /^Briga, 0 → 1/ })
      await brawl.click()
      await expect(brawl).toHaveAttribute('aria-checked', 'true')
      await expect(playerPage.getByTestId('xp-request-summary')).toHaveText(
        /^Briga: 0 → 1\. Custo \d+ XP \(disponível 20\)\.$/
      )
      const posted = playerPage.waitForResponse(
        r => r.url().endsWith('/xp-requests') && r.request().method() === 'POST'
      )
      await send.click()
      expect((await posted).status()).toBe(201)
    })
  })
}

test.describe('a 390', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('acima do saldo: aria-disabled sem `disabled`, o motivo e nenhum pedido (T-77)', async ({
    browser,
    page,
  }) => {
    // Briga nova custa mais que 1 XP
    const { id, playerPage } = await sheetWithXp(browser, page, 1)
    const requests: string[] = []
    playerPage.on('request', r => {
      if (r.url().endsWith('/xp-requests') && r.method() === 'POST')
        requests.push(r.url())
    })
    await playerPage.goto(`/characters/${id}`)
    await openExperience(playerPage)
    await playerPage
      .getByRole('button', { name: 'Solicitar evolução', exact: true })
      .click()
    await playerPage.getByLabel('Buscar traço').fill('brig')
    // A opção acima do saldo é tocável e diz o motivo (aria-disabled; force:
    // o Playwright não clica em aria-disabled sem ele, lição da onda 4)
    await playerPage
      .getByRole('radio', { name: /^Briga, .*faltam/ })
      .click({ force: true })
    const send = playerPage.getByRole('button', {
      name: 'Enviar pedido',
      exact: true,
    })
    await expect(send).toHaveAttribute('aria-disabled', 'true')
    await expect(send).not.toHaveAttribute('disabled', /.*/)
    // Tocável: o clique mostra o motivo (force: o Playwright não clica em
    // aria-disabled sem ele, lição da onda 4)
    await send.click({ force: true })
    await expect(playerPage.getByRole('alert')).toContainText('Faltam')
    expect(requests).toEqual([])
  })

  // §11.6, ponto 4 (decisão do PO): o pedido pendente se comporta como o
  // acima do saldo. No web: aria-disabled sem `disabled`, tocável, o motivo
  // e nenhum segundo pedido (o servidor também recusaria)
  test('pedido pendente: aria-disabled sem `disabled`, tocável, o motivo e nenhum pedido (P13)', async ({
    browser,
    page,
  }) => {
    const { id, playerPage, playerContext, player } = await sheetWithXp(
      browser,
      page,
      20
    )
    await apiAs(
      playerContext,
      player,
      'POST',
      `/characters/${id}/xp-requests`,
      {
        clientRequestId: randomUUID(),
        field: 'brawl',
      }
    )
    // Fecha a página do jogador no fim: aberta, com a folha e as rebuscas,
    // ela deixava o WebKit instável no caso seguinte (U-02 a 1280)
    try {
      const requests: string[] = []
      playerPage.on('request', r => {
        if (r.url().endsWith('/xp-requests') && r.method() === 'POST')
          requests.push(r.url())
      })
      await playerPage.goto(`/characters/${id}`)
      await openExperience(playerPage)
      await playerPage
        .getByRole('button', { name: 'Solicitar evolução', exact: true })
        .click()
      await playerPage.getByLabel('Buscar traço').fill('brig')
      const brawl = playerPage.getByRole('radio', {
        name: /^Briga, .*pedido pendente$/,
      })
      await expect(brawl).toHaveAttribute('aria-disabled', 'true')
      await expect(brawl).not.toHaveAttribute('disabled', /.*/)
      // Tocável (force: o Playwright não clica em aria-disabled sem ele, lição
      // da onda 4): a opção é marcada, e o rodapé diz o motivo
      await brawl.click({ force: true })
      await expect(brawl).toHaveAttribute('aria-checked', 'true')
      const reason = 'Já existe um pedido pendente para este traço.'
      await expect(playerPage.getByTestId('xp-request-refusal')).toHaveText(
        reason
      )
      const send = panel(playerPage).getByRole('button', {
        name: 'Enviar pedido',
        exact: true,
      })
      await expect(send).toHaveAttribute('aria-disabled', 'true')
      await send.click({ force: true })
      await expect(playerPage.getByRole('alert')).toContainText(reason)
      expect(requests).toEqual([])
    } finally {
      await playerContext.close()
    }
  })

  test('"Peça ao narrador." abre a Experiência com o traço marcado (U-01)', async ({
    browser,
    page,
  }) => {
    const { id, playerPage } = await sheetWithXp(browser, page, 20)
    await playerPage.goto(`/characters/${id}`)
    await playerPage.getByRole('radio', { name: 'Editar', exact: true }).click()
    await playerPage
      .getByRole('button', {
        name: 'Solicitar evolução de Força',
        exact: true,
      })
      .click()
    await expect(
      playerPage.getByRole('radio', { name: /^Força, / })
    ).toHaveAttribute('aria-checked', 'true')
    await expect(playerPage.getByTestId('xp-request-summary')).toHaveText(
      /^Força: /
    )
  })
})

test.describe('a 1280', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('o narrador concede XP digitando o valor (U-02)', async ({
    browser,
    page,
  }) => {
    const { id } = await sheetWithXp(browser, page, 1)
    await page.goto(`/characters/${id}`)
    await openExperience(page)
    await page.getByRole('button', { name: 'Conceder XP', exact: true }).click()
    await page.getByRole('button', { name: 'Digitar XP a conceder' }).click()
    const amount = page.getByLabel('XP a conceder, de 1 a 1000')
    await amount.fill('10')
    await amount.press('Enter')
    await page.getByLabel('Motivo').fill('Sessão 2')
    const granted = page.waitForResponse(
      r =>
        /\/chronicles\/[^/]+\/xp$/.test(r.url()) &&
        r.request().method() === 'POST'
    )
    await page.getByTestId('xp-grant-confirm').click()
    const body = JSON.parse((await granted).request().postData() ?? '{}')
    expect(body.amount).toBe(10)
  })
})
