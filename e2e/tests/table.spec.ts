import { expect, test } from '@playwright/test'
import { apiAs, eighthGeneration, freeCreation, signUp } from '../support/users'

// Etapa 19: a Mesa do narrador. O narrador vê o dock de cada personagem,
// abre a ficha em Leitura, edita como narrador (assinado no histórico) e a
// jogadora vê a mudança ao voltar para a ficha, sem tempo real.
test('o narrador edita pela Mesa e a jogadora vê ao voltar para a ficha', async ({
  browser,
  page,
}) => {
  const context = page.context()
  const storyteller = await signUp(context, 'narra')
  const chronicle = await apiAs<{ id: string }>(
    context,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica da Liberdade', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, storyteller, chronicle.id)
  const invite = await apiAs<{ code: string }>(
    context,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`,
    {}
  )

  const playerContext = await browser.newContext()
  const player = await signUp(playerContext, 'helena')
  await apiAs(playerContext, player, 'POST', '/invites/accept', {
    code: invite.code,
  })
  const character = await apiAs<{ id: string }>(
    playerContext,
    player,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    {
      values: { name: 'Helena Varga', clan: 'tremere' },
    }
  )
  await eighthGeneration(playerContext, player, character.id)

  // A jogadora está com a ficha aberta, sem ferimentos
  const sheet = await playerContext.newPage()
  await sheet.goto(`/characters/${character.id}`)
  await expect(
    sheet.getByLabel('Vitalidade: Sem ferimentos; sem dano')
  ).toBeVisible()

  // O narrador abre a Mesa: o dock do Vampiro em cada linha
  await page.goto(`/chronicles/${chronicle.id}`)
  await page.getByRole('tab', { name: 'Mesa' }).click()
  const row = page.getByRole('button', { name: /^Helena Varga, Tremere\./ })
  await expect(row).toBeVisible()
  await expect(row).toHaveAccessibleName(/Pontos de Sangue, 15 de 15/)
  await row.click()
  await expect(page).toHaveURL(new RegExp(`/characters/${character.id}$`))

  // Em Leitura; editar como narrador é explícito
  await expect(page.getByText(`Ficha de ${player.username}.`)).toBeVisible()
  await page.getByRole('button', { name: 'Editar como narrador' }).click()
  await expect(
    page.getByText('As alterações ficam assinadas no histórico.')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Editar Notas do Narrador' }).click()
  await page
    .getByRole('textbox', { name: 'Notas do Narrador', exact: true })
    .fill('O Regente vai cobrar.')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeVisible()
  // Geração foi o primeiro lote; as notas do narrador são o segundo.
  // O lote sai em segundo plano: espera o servidor confirmar.
  await expect
    .poll(
      async () =>
        (
          await apiAs<{ sheetVersion: number }>(
            context,
            storyteller,
            'GET',
            `/characters/${character.id}`
          )
        ).sheetVersion
    )
    .toBe(2)

  // O dano entra pelo sheet da Vitalidade, em Jogo, como narrador
  const hurt = page.waitForResponse(
    r =>
      r.url().endsWith(`/characters/${character.id}/events`) &&
      r.request().method() === 'POST' &&
      r.status() === 200
  )
  await page
    .getByRole('button', { name: 'Vitalidade: Sem ferimentos; sem dano' })
    .click()
  await page.getByRole('button', { name: 'Aumentar Dano letal' }).click()
  await hurt
  await page.getByRole('button', { name: 'Fechar' }).last().click()

  // O histórico mostra quem alterou e com que papel
  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(
    page.getByText(`${storyteller.username} (narrador)`, { exact: false })
  ).toHaveCount(2)

  // A jogadora volta para a ficha (sai e entra): a ficha é rebuscada
  await sheet
    .getByRole('button', { name: 'Voltar para Crônica da Liberdade' })
    .click()
  await sheet.getByRole('button', { name: /^Helena Varga, / }).click()
  await expect(sheet.getByLabel(/^Vitalidade: Escoriado/)).toBeVisible()
  // E não vê as Notas do Narrador nem no histórico
  await sheet.getByRole('button', { name: 'Histórico' }).click()
  await expect(sheet.getByText('Vitalidade: +1 letal')).toBeVisible()
  await expect(sheet.getByText(/Notas do Narrador/)).toHaveCount(0)
  await playerContext.close()
})
