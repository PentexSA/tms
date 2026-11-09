import { randomUUID } from 'node:crypto'
import { type Browser, expect, type Page, test } from '@playwright/test'
import { apiAs, completeCreation, freeCreation, signUp } from '../support/users'

// P15-D (U-10, D-16): a História / Prelúdio, que a narradora e a dona leem,
// separada das Notas do Narrador, que continuam privadas. O que só o E2E
// pega: a resposta da rede sem a marca das Notas, o `aria-describedby` real
// no DOM e a rolagem do texto longo a 390. Contas, fichas e textos
// fictícios, pela API.
//
// O segundo teste edita pela tela: depende do T-84 (P13), que põe o editor
// no TextLayout do Sobre. Ele roda na integração, depois do merge do P13.

const STORY = `HIST-E2E-${randomUUID().slice(0, 8)}`
const SECRET = `SEGREDO-E2E-${randomUUID().slice(0, 8)}`
const END = 'FIM-P15D'

/** Narradora, crônica de Vampiro (criação livre) e duas jogadoras. */
async function chronicle(browser: Browser, page: Page) {
  const desk = page.context()
  const storyteller = await signUp(desk, 'narra_p15')
  const { id: chronicleId } = await apiAs<{ id: string }>(
    desk,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica da História', systemCode: 'vtm-v20' }
  )
  await freeCreation(desk, storyteller, chronicleId)
  const join = async (prefix: string) => {
    const { code } = await apiAs<{ code: string }>(
      desk,
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/invites`
    )
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    })
    const user = await signUp(context, prefix)
    await apiAs(context, user, 'POST', '/invites/accept', { code })
    return { context, user }
  }
  const owner = await join('dona_p15')
  const other = await join('outra_p15')
  const { id } = await apiAs<{ id: string }>(
    owner.context,
    owner.user,
    'POST',
    `/chronicles/${chronicleId}/characters`,
    { values: { name: 'Helena Varga', clan: 'tremere' } }
  )
  await completeCreation(desk, storyteller, id)
  return { desk, storyteller, chronicleId, owner, other, id }
}

const batch = (path: string, from: string | null, to: string) => ({
  clientBatchId: randomUUID(),
  events: [{ path, from, to }],
})

test.describe('a 390', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a narradora escreve, a dona lê, a outra jogadora não', async ({
    browser,
    page,
  }) => {
    const { desk, storyteller, owner, other, id } = await chronicle(
      browser,
      page
    )
    // Um texto longo, fictício, que termina numa marca
    const long = `${STORY} ${'Texto de teste do roteiro, sem conteúdo de jogo. '.repeat(70)}${END}`
    await apiAs(
      desk,
      storyteller,
      'POST',
      `/characters/${id}/events`,
      batch('values.backstory', null, long)
    )
    await apiAs(
      desk,
      storyteller,
      'POST',
      `/characters/${id}/events`,
      batch('values.storytellerNotes', null, SECRET)
    )

    // A dona: a resposta tem a História e não tem as Notas
    const ownerPage = await owner.context.newPage()
    const response = ownerPage.waitForResponse(
      r =>
        r.request().resourceType() === 'fetch' &&
        r.url().endsWith(`/characters/${id}`) &&
        r.request().method() === 'GET'
    )
    await ownerPage.goto(`/characters/${id}`)
    const body = await (await response).text()
    expect(body).toContain(STORY)
    expect(body).not.toContain(SECRET)

    await ownerPage.getByRole('tab', { name: 'Sobre', exact: true }).click()
    await expect(
      ownerPage.getByText('História / Prelúdio', { exact: true })
    ).toBeVisible()
    await expect(ownerPage.getByText(/Notas do Narrador/)).toHaveCount(0)
    // O texto inteiro rola até o fim, sem passar da largura
    const end = ownerPage.getByText(new RegExp(`${END}$`))
    await end.scrollIntoViewIfNeeded()
    await expect(end).toBeVisible()
    expect(
      await ownerPage.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(390)

    // A outra jogadora: sem acesso, e a resposta sem nenhuma das marcas
    const otherPage = await other.context.newPage()
    const denied = otherPage.waitForResponse(
      r =>
        r.request().resourceType() === 'fetch' &&
        r.url().endsWith(`/characters/${id}`) &&
        r.request().method() === 'GET'
    )
    await otherPage.goto(`/characters/${id}`)
    const deniedBody = await (await denied).text()
    expect(deniedBody).not.toContain(STORY)
    expect(deniedBody).not.toContain(SECRET)
    await expect(
      otherPage.getByRole('heading', {
        name: 'Você não tem acesso a esta ficha',
      })
    ).toBeVisible()

    await owner.context.close()
    await other.context.close()
  })

  // Saída A da D-16: os dois escrevem pela tela (Editar → Sobre). Depende do
  // T-84 (P13), que desenha o editor de texto no Sobre
  test('a narradora e a dona editam a História pelo Editar', async ({
    browser,
    page,
  }) => {
    const { owner, other, id } = await chronicle(browser, page)
    await other.context.close()

    // A narradora: "Editar como narrador" → Editar → Sobre
    await page.goto(`/characters/${id}`)
    await page.getByRole('button', { name: 'Editar como narrador' }).click()
    await page.getByRole('radio', { name: 'Editar', exact: true }).click()
    await page.getByRole('tab', { name: 'Sobre', exact: true }).click()
    await page.getByTestId('editor-backstory').first().click()
    const field = page.getByRole('textbox', {
      name: 'História / Prelúdio',
      exact: true,
    })
    // O aviso no DOM, com o campo, e não o das Notas
    await expect(field).toHaveAccessibleDescription(
      /^O jogador lê este texto\./
    )
    await expect(
      page.getByText('Privadas: o jogador não vê estas notas.')
    ).toHaveCount(0)
    await field.fill(STORY)
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await page
      .getByRole('button', { name: 'Salvar alterações', exact: true })
      .click()
    const saved = page.waitForResponse(
      r =>
        r.url().endsWith(`/characters/${id}/events`) &&
        r.request().method() === 'POST'
    )
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    expect((await saved).status()).toBe(200)

    // A dona lê e edita; o editor dela não tem aviso
    const ownerPage = await owner.context.newPage()
    await ownerPage.goto(`/characters/${id}`)
    await ownerPage.getByRole('radio', { name: 'Editar', exact: true }).click()
    await ownerPage.getByRole('tab', { name: 'Sobre', exact: true }).click()
    await ownerPage.getByTestId('editor-backstory').first().click()
    const own = ownerPage.getByRole('textbox', {
      name: 'História / Prelúdio',
      exact: true,
    })
    await expect(own).toHaveValue(STORY)
    await expect(ownerPage.getByText('O jogador lê este texto.')).toHaveCount(0)
    await own.fill(`${STORY} e da dona`)
    await ownerPage
      .getByRole('button', { name: 'Aplicar', exact: true })
      .click()
    await ownerPage
      .getByRole('button', { name: 'Salvar alterações', exact: true })
      .click()
    const ownSaved = ownerPage.waitForResponse(
      r =>
        r.url().endsWith(`/characters/${id}/events`) &&
        r.request().method() === 'POST'
    )
    await ownerPage.getByRole('button', { name: 'Salvar', exact: true }).click()
    expect((await ownSaved).status()).toBe(200)

    // O Histórico da narradora mostra o lote da dona, sem o texto
    await page.goto(`/characters/${id}`)
    await page.getByRole('button', { name: 'Mais opções' }).click()
    await page.getByRole('button', { name: 'Histórico', exact: true }).click()
    await expect(page.getByText('História / Prelúdio').first()).toBeVisible()
    await expect(page.getByText(`${STORY} e da dona`)).toHaveCount(0)

    await owner.context.close()
  })
})
