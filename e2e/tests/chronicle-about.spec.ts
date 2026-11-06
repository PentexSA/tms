import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { apiAs, freeCreation, rawAs, signUp } from '../support/users'

// P14-D (U-09, D-15): a Apresentação da crônica para leitura. O jogador e o
// narrador leem a Descrição inteira pelo "Ler tudo"; o ex-membro e o
// convidado que não entrou, não. Texto fictício, escrito para o teste.

const READ_ALL = 'Ler tudo: apresentação da crônica'
const MARKER = 'marca-apresentacao-e2e-4d7a'
const MARKUP = '*isto não é negrito* [nem link](https://exemplo.test)'
const paragraph = (n: number) =>
  Array.from(
    { length: 6 },
    (_, i) => `Parágrafo de teste do roteiro, número ${n}, frase ${i + 1}.`
  ).join(' ')
const DESCRIPTION = [
  `${paragraph(1)} ${MARKER}`,
  `${MARKUP}\n${paragraph(2)}`,
  `${paragraph(3)} Fim da apresentação.`,
].join('\n\n')

test('a Apresentação da crônica: trecho, leitura, ex-membro e convidado', async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000)
  const storytellerContext = page.context()
  const mobile = { viewport: { width: 390, height: 844 } }
  const playerContext = await browser.newContext(mobile)
  const formerContext = await browser.newContext(mobile)
  const guestContext = await browser.newContext(mobile)

  try {
    await page.setViewportSize({ width: 1280, height: 800 })
    const storyteller = await signUp(storytellerContext, 'about_narra')
    const player = await signUp(playerContext, 'about_jogador')
    const former = await signUp(formerContext, 'about_former')
    // O convidado só precisa de uma sessão: não usa o convite
    await signUp(guestContext, 'about_convidado')

    // Preparação pela API: a crônica, a Descrição, o jogador e o ex-membro
    // entram pelo convite; o convidado tem um convite e não o usa. O código
    // não vai para o log
    const chronicle = await apiAs<{ id: string }>(
      storytellerContext,
      storyteller,
      'POST',
      '/chronicles',
      { name: 'Crônica da Apresentação', systemCode: 'vtm-v20' }
    )
    await freeCreation(storytellerContext, storyteller, chronicle.id)
    await apiAs(
      storytellerContext,
      storyteller,
      'PATCH',
      `/chronicles/${chronicle.id}`,
      { clientCommandId: randomUUID(), revision: 0, description: DESCRIPTION }
    )
    // Marcação nunca chega ao banco: 422, sem ecoar o texto
    const markup = await rawAs(
      storytellerContext,
      storyteller,
      'PATCH',
      `/chronicles/${chronicle.id}`,
      {
        clientCommandId: randomUUID(),
        revision: 1,
        description: 'texto com <b>marca</b>',
      }
    )
    expect(markup.status()).toBe(422)
    expect(await markup.text()).not.toContain('<b>')
    const invite = await apiAs<{ code: string }>(
      storytellerContext,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/invites`,
      { maxUses: 3 }
    )
    for (const [context, user] of [
      [playerContext, player],
      [formerContext, former],
    ] as const)
      await apiAs(context, user, 'POST', '/invites/accept', {
        code: invite.code,
      })
    await apiAs(
      formerContext,
      former,
      'POST',
      `/chronicles/${chronicle.id}/characters`,
      { values: { name: 'Saida R' } }
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

    // Jogador a 390: o bloco com o trecho e "Ler tudo", e as abas logo abaixo
    const playerPage = await playerContext.newPage()
    await playerPage.goto(`/chronicles/${chronicle.id}`)
    const readAll = playerPage.getByRole('button', {
      name: READ_ALL,
      exact: true,
    })
    await expect(readAll).toBeVisible()
    await expect(readAll).toHaveAttribute('aria-label', READ_ALL)
    const block = playerPage.getByTestId('chronicle-about')
    const excerpt = playerPage.getByTestId('chronicle-about-excerpt')
    const shown = (await excerpt.textContent()) ?? ''
    // O leitor de tela recebe o trecho, nunca os 4000
    expect(Array.from(shown).length).toBeLessThanOrEqual(141)
    expect(shown.endsWith('…')).toBe(true)
    expect(shown).not.toContain(MARKER)
    const box = await block.boundingBox()
    expect(box?.height ?? 0).toBeLessThanOrEqual(104)
    const tabs = await playerPage
      .getByRole('tablist', { name: 'Visão da crônica' })
      .boundingBox()
    expect(tabs?.y ?? 0).toBeGreaterThanOrEqual(
      (box?.y ?? 0) + (box?.height ?? 0)
    )

    await readAll.click()
    await expect(playerPage).toHaveURL(
      new RegExp(`/chronicles/${chronicle.id}/about$`)
    )
    await expect(
      playerPage.getByRole('heading', { name: 'Apresentação', level: 1 })
    ).toBeVisible()
    const text = playerPage.getByTestId('chronicle-about-text')
    // A marcação aparece literal, e nada vira link nem HTML
    await expect(text.getByText(MARKUP, { exact: false })).toBeVisible()
    expect(await text.locator('a').count()).toBe(0)
    expect(await text.locator('b, strong, em').count()).toBe(0)
    const last = playerPage.getByText('Fim da apresentação.', { exact: false })
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeVisible()
    // F5 mantém a tela; o voltar do navegador volta à crônica
    await playerPage.reload()
    await expect(
      playerPage.getByRole('heading', { name: 'Apresentação', level: 1 })
    ).toBeVisible()
    await expect(playerPage.getByText(MARKER, { exact: false })).toBeVisible()
    await playerPage.goBack()
    await expect(playerPage).toHaveURL(
      new RegExp(`/chronicles/${chronicle.id}$`)
    )
    await expect(readAll).toBeVisible()
    // Pelo "‹" da leitura: volta à crônica
    await readAll.click()
    await playerPage
      .getByRole('button', { name: 'Voltar para Crônica da Apresentação' })
      .click()
    await expect(playerPage).toHaveURL(
      new RegExp(`/chronicles/${chronicle.id}$`)
    )

    // Narrador a 1280: a dica no editor, uma frase nova e a leitura
    await page.goto(`/chronicles/${chronicle.id}?view=backstage`)
    await expect(
      page.getByText('Os jogadores da crônica leem este texto.', {
        exact: false,
      })
    ).toBeVisible()
    const field = page.getByRole('textbox', { name: 'Descrição', exact: true })
    await field.fill(`${DESCRIPTION}\n\nFrase nova do roteiro.`)
    // Espera o PATCH responder antes de sair da tela
    const saved = page.waitForResponse(
      res =>
        res.url().endsWith(`/chronicles/${chronicle.id}`) &&
        res.request().method() === 'PATCH'
    )
    await page.getByRole('button', { name: 'Salvar apresentação' }).click()
    expect((await saved).status()).toBe(200)
    await page.goto(`/chronicles/${chronicle.id}/about`)
    await expect(page.getByText('Frase nova do roteiro.')).toBeVisible()
    const column = await page.getByTestId('chronicle-about-text').boundingBox()
    expect(column?.width ?? 0).toBeLessThanOrEqual(640)

    // Ex-membro a 390: sem bloco na crônica; a leitura direta diz que saiu.
    // A API ainda lhe manda a Descrição (onda-5.md §6, ponto 5, em aberto):
    // aqui se confere só a tela
    const formerPage = await formerContext.newPage()
    await formerPage.goto(`/chronicles/${chronicle.id}`)
    await expect(formerPage.getByTestId('former-banner')).toBeVisible()
    await expect(
      formerPage.getByRole('button', { name: READ_ALL, exact: true })
    ).toHaveCount(0)
    await formerPage.goto(`/chronicles/${chronicle.id}/about`)
    await expect(
      formerPage.getByRole('heading', { name: 'Você saiu desta crônica' })
    ).toBeVisible()
    await expect(formerPage.getByText(MARKER, { exact: false })).toHaveCount(0)

    // Convidado que não entrou, a 390: 404, sem nada da Descrição
    const guestPage = await guestContext.newPage()
    const response = guestPage.waitForResponse(
      res =>
        res.url().endsWith(`/chronicles/${chronicle.id}`) &&
        res.request().method() === 'GET'
    )
    await guestPage.goto(`/chronicles/${chronicle.id}/about`)
    const res = await response
    expect(res.status()).toBe(404)
    expect(await res.text()).not.toContain(MARKER)
    await expect(
      guestPage.getByRole('heading', { name: 'Crônica não encontrada' })
    ).toBeVisible()
    await expect(guestPage.getByText(MARKER, { exact: false })).toHaveCount(0)
  } finally {
    await playerContext.close()
    await formerContext.close()
    await guestContext.close()
  }
})
