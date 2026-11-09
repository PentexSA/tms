import { expect, type Locator, type Page, test } from '@playwright/test'
import { newCharacter, pointsChronicle, tab } from '../support/creation'
import { apiAs, freeCreation, signUp } from '../support/users'

// P10-D (R-19, U-06): o "?" da ajuda contextual, no padrão disclosure, e a
// "Casa ou subgrupo" do Mago. Contra o export web com a CSP de produção e os
// templates publicados pelo seed. Só contas fictícias.
//
// O que o Jest não pega no web e este spec confere no DOM: o aria-expanded, o
// aria-controls apontando um elemento que existe, o aria-live="polite" da
// frase e o tamanho do alvo.

const helpIn = (page: Page, testId: string, subject: string) =>
  page.getByTestId(testId).getByRole('button', {
    name: `Ajuda: ${subject}`,
    exact: true,
  })

/** O alvo do "?" tem pelo menos 44 × 44 no web. */
async function expectTarget(button: Locator) {
  const box = await button.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
}

/** O botão controla a frase: o id existe, é região viva educada e tem o texto. */
async function expectDisclosure(page: Page, button: Locator) {
  const controls = await button.getAttribute('aria-controls')
  expect(controls).toBeTruthy()
  const text = page.locator(`[id="${controls}"]`)
  await expect(text).toBeVisible()
  await expect(text).toHaveAttribute('aria-live', 'polite')
  return text
}

test.describe('a 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Vampiro por pontos: Talento e Virtude Consciência, cada um com a sua frase (IW-06)', async ({
    browser,
    page,
  }) => {
    const context = page.context()
    const { chronicleId, user } = await pointsChronicle(browser, context)
    const character = await newCharacter(context, user, chronicleId)
    await page.goto(`/characters/${character.id}?mode=create`)

    await tab(page, 'Talentos')
    const talent = helpIn(page, 'editor-awareness', 'Consciência')
    await expect(talent).toHaveAttribute('aria-expanded', 'false')
    await expectTarget(talent)
    // Teclado: Enter abre, Espaço fecha
    await talent.focus()
    await page.keyboard.press('Enter')
    await expect(talent).toHaveAttribute('aria-expanded', 'true')
    const talentText = await expectDisclosure(page, talent)
    const talentPhrase = await talentText.textContent()
    await page.keyboard.press(' ')
    await expect(talent).toHaveAttribute('aria-expanded', 'false')

    // A linha com Stepper e "?" cabe a 390: o "+" continua na tela, com o nome de hoje
    const plusAwareness = page.getByRole('button', {
      name: 'Aumentar Consciência',
      exact: true,
    })
    await expect(plusAwareness).toBeInViewport()
    const talentBox = await talent.boundingBox()
    expect((talentBox?.x ?? 0) + (talentBox?.width ?? 0)).toBeLessThanOrEqual(
      390
    )
    const scroll = await page.evaluate(
      () => document.documentElement.scrollWidth
    )
    expect(scroll).toBeLessThanOrEqual(390)

    await page.getByRole('tab', { name: /^Vantagens(, a seguir)?$/ }).click()
    const virtue = helpIn(page, 'editor-conscience', 'Consciência')
    await virtue.click()
    await expect(virtue).toHaveAttribute('aria-expanded', 'true')
    const virtueText = await expectDisclosure(page, virtue)
    expect(await virtueText.textContent()).not.toBe(talentPhrase)
  })
})

test('a ajuda aberta dentro de uma folha: o Esc fecha a folha e o foco volta', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'ajuda_folha')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica da ajuda', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, user, chronicle.id)
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page.getByLabel('Nome (obrigatório)').fill('Vera Lúcida')
  await page.getByRole('radio', { name: 'Tremere' }).click()
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page.getByText('Editando · 0 alterações')).toBeVisible()

  // A linha do Clã abre a folha das opções; cada clã com frase tem o "?"
  const row = page.getByTestId('editor-clan')
  await row.click()
  const dialog = page.locator('[aria-modal="true"]').first()
  await expect(dialog).toBeVisible()
  const brujah = dialog.getByRole('button', {
    name: 'Ajuda: Brujah',
    exact: true,
  })
  await brujah.click()
  await expect(brujah).toHaveAttribute('aria-expanded', 'true')
  await expectDisclosure(page, brujah)
  // O "?" não escolheu o clã
  await expect(
    dialog.getByRole('radio', { name: 'Brujah', exact: true })
  ).not.toBeChecked()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(row).toBeFocused()
})

test.describe('a 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('Mago: "Casa ou subgrupo" opcional, e a Verbena nasce sem Casa (U-06)', async ({
    page,
  }) => {
    const context = page.context()
    const user = await signUp(context, 'ajuda_mago')
    const chronicle = await apiAs<{ id: string }>(
      context,
      user,
      'POST',
      '/chronicles',
      { name: 'A Torre', systemCode: 'mta-m20' }
    )
    await page.goto(`/chronicles/${chronicle.id}/new-character`)
    await page.getByLabel('Nome (obrigatório)').fill('Iara Lune')
    await page.getByRole('radio', { name: 'Verbena', exact: true }).click()
    const house = page.getByLabel('Casa ou subgrupo', { exact: true })
    await expect(house).toHaveValue('')
    await expect(house).toHaveAttribute('placeholder', 'Opcional')
    const help = page.getByRole('button', {
      name: 'Ajuda: Casa ou subgrupo',
      exact: true,
    })
    await help.click()
    const text = await expectDisclosure(page, help)
    await expect(text).toContainText('opcional')
    await page.getByRole('button', { name: 'Criar ficha' }).click()
    await expect(page).toHaveURL(
      /\/characters\/[0-9a-f-]{36}(\?mode=(evolve|create))?$/
    )
  })
})
