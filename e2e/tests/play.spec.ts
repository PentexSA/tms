import { expect, type Page, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// Etapa 17: a dona abre a ficha em Jogo, gasta Sangue e leva dano; depois de
// recarregar a página, os valores vieram do servidor (não do otimista).

async function newCharacter(page: Page) {
  const context = page.context()
  const user = await signUp(context, 'jogo')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica da Liberdade', systemCode: 'vtm-v20' }
  )
  // 13ª geração (padrão) e Sangue sem valor guardado: cheio, 10 de 10. A
  // criação só aceita os campos da identidade
  return apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Helena Varga' } }
  )
}

/** Espera o lote chegar ao servidor (a fila manda em segundo plano). */
const saved = (page: Page) =>
  page.waitForResponse(
    r =>
      /\/characters\/[0-9a-f-]{36}\/events$/.test(r.url()) &&
      r.request().method() === 'POST' &&
      r.status() === 200
  )

const close = (page: Page) =>
  page.getByRole('button', { name: 'Fechar' }).last().click()

test('no computador: gastar Sangue e levar dano pelos sheets, recarregar e conferir', async ({
  page,
}) => {
  const character = await newCharacter(page)
  await page.goto(`/characters/${character.id}`)

  // A partir de 600 não há dock: a seção "Em jogo" abre os mesmos sheets
  await page.getByRole('button', { name: 'Pontos de Sangue, 10 de 10' }).click()
  await expect(
    page.getByRole('heading', { name: 'Pontos de Sangue' })
  ).toBeVisible()
  const spent = saved(page)
  await page.getByRole('button', { name: 'Gastar 1', exact: true }).click()
  await spent
  await close(page)

  await page
    .getByRole('button', { name: 'Vitalidade: Sem ferimentos; sem dano' })
    .click()
  const hurt = saved(page)
  // No web, o stepper tem botões de verdade
  await page.getByRole('button', { name: 'Aumentar Dano letal' }).click()
  await hurt
  await close(page)

  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Pontos de Sangue, 9 de 10' })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Vitalidade: Escoriado.*1 letal$/ })
  ).toBeVisible()
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('o dock: toque longo gasta Sangue, com Desfazer', async ({ page }) => {
    const character = await newCharacter(page)
    await page.goto(`/characters/${character.id}`)

    const chip = page.getByRole('button', {
      name: 'Pontos de Sangue, 10 de 10. Toque longo: Gastar 1 Sangue',
    })
    await expect(chip).toBeVisible()
    const spent = saved(page)
    // Toque longo (500 ms) com o mouse segurado
    await chip.click({ delay: 800 })
    await spent
    await expect(page.getByText('Sangue 10 → 9')).toBeVisible()

    await page.reload()
    await expect(
      page.getByRole('button', { name: /^Pontos de Sangue, 9 de 10\./ })
    ).toBeVisible()
  })
})
