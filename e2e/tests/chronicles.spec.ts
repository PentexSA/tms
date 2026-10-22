import { expect, test } from '@playwright/test'
import { signUp } from '../support/users'

// Etapa 11: o narrador cria a crônica e o convite; o jogador entra com o
// código; os dois veem a mesma mesa.
test('narrador convida e o jogador entra com o código', async ({
  browser,
  page,
}) => {
  const storyteller = await signUp(page.context(), 'narra')
  await page.goto('/')
  await expect(
    page.getByRole('heading', {
      name: 'Você ainda não participa de nenhuma crônica',
    })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Criar crônica' }).click()
  await page.getByLabel('Nome da crônica').fill('Crônica da Liberdade')
  // Com Vampiro e Mago publicados, o sistema é escolhido (v1)
  const vampire = page.getByRole('radio', { name: /Vampiro: A Máscara/ })
  await vampire.click()
  await expect(vampire).toBeChecked()
  await page.getByRole('button', { name: 'Criar crônica' }).click()
  await expect(
    page.getByRole('heading', { name: 'Crônica da Liberdade' })
  ).toBeVisible()
  await expect(page.getByText('Você narra esta crônica.')).toBeVisible()

  await page.getByRole('button', { name: 'Convidar' }).click()
  await page.getByRole('button', { name: 'Gerar convite' }).click()
  const code = (await page.getByTestId('invite-code-value').innerText()).trim()
  expect(code).toMatch(/^[0-9A-Z ]{30,32}$/)
  await expect(page.getByText(/10 usos restantes/)).toBeVisible()

  // O jogador, em outro navegador, entra com o código digitado em minúsculas
  const other = await browser.newContext()
  const playerPage = await other.newPage()
  const player = await signUp(other, 'joga')
  await playerPage.goto('/')
  await playerPage.getByRole('button', { name: 'Entrar com convite' }).click()
  await playerPage.getByLabel('Código do convite').fill(code.toLowerCase())
  await playerPage.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(
    playerPage.getByText(`Narrador: ${storyteller.username}`, { exact: true })
  ).toBeVisible()
  await expect(
    playerPage.getByRole('button', { name: 'Convidar' })
  ).toHaveCount(0)

  await playerPage.getByRole('button', { name: 'Voltar para Crônicas' }).click()
  await expect(
    playerPage.getByRole('button', {
      name: new RegExp(
        `Crônica da Liberdade.*Narrador: ${storyteller.username}`
      ),
    })
  ).toBeVisible()

  // O narrador vê o jogador na mesa
  await page.reload()
  await expect(page.getByText(player.username, { exact: true })).toBeVisible()
  await other.close()
})

test('código inválido não entra em crônica nenhuma', async ({ page }) => {
  await signUp(page.context(), 'curioso')
  await page.goto('/join')
  await page
    .getByLabel('Código do convite')
    .fill('0000 0000 0000 0000 0000 0000 00')
  await page.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'convite inválido ou expirado'
  )
})
