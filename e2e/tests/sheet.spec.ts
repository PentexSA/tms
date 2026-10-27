import { expect, test } from '@playwright/test'
import { apiAs, eighthGeneration, freeCreation, signUp } from '../support/users'

// Etapa 13: uma ficha criada pela API abre no navegador em Leitura, com a
// identidade, "Em jogo" e as 3 abas do Vampiro.
test('a ficha abre em Leitura com as 3 abas; só o narrador vê as notas dele', async ({
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
    {
      name: 'Crônica da Liberdade',
      systemCode: 'vtm-v20',
    }
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
      values: {
        name: 'Helena Varga',
        concept: 'Arquivista da Capela',
        clan: 'tremere',
      },
    }
  )
  await eighthGeneration(playerContext, player, character.id)

  // A jogadora abre a própria ficha
  const sheet = await playerContext.newPage()
  await sheet.goto(`/characters/${character.id}`)
  // Um título só: o da tela (a identidade não repete o heading)
  await expect(
    sheet.getByRole('heading', { name: 'Helena Varga' })
  ).toHaveCount(1)
  await expect(sheet.getByText('Tremere', { exact: true })).toBeVisible()
  await expect(sheet.getByLabel('Pontos de Sangue, 15 de 15')).toBeVisible()
  await expect(sheet.getByLabel('Força, 1 de 5')).toBeVisible()
  await expect(sheet.getByRole('tab')).toHaveText([
    'Ficha',
    'Vantagens',
    'Sobre',
  ])
  await sheet.getByRole('tab', { name: 'Vantagens' }).click()
  await expect(sheet.getByLabel('Disciplinas: 0 itens')).toBeVisible()
  await sheet.getByRole('tab', { name: 'Sobre' }).click()
  await expect(sheet.getByLabel('Notas: vazio')).toBeVisible()
  await expect(sheet.getByText('Notas do Narrador')).toHaveCount(0)
  await sheet
    .getByRole('button', { name: 'Voltar para Crônica da Liberdade' })
    .click()
  await expect(
    sheet.getByRole('heading', { name: 'Crônica da Liberdade' })
  ).toBeVisible()

  // A narradora abre a mesma ficha e vê a seção dela
  await page.goto(`/characters/${character.id}`)
  await page.getByRole('tab', { name: 'Sobre' }).click()
  await expect(page.getByLabel('Notas do Narrador: vazio')).toBeVisible()
  await playerContext.close()
})

test('ficha alheia: sem acesso', async ({ page }) => {
  await signUp(page.context(), 'curiosa')
  await page.goto('/characters/00000000-0000-4000-8000-000000000000')
  await expect(
    page.getByRole('heading', { name: 'Você não tem acesso a esta ficha' })
  ).toBeVisible()
})
