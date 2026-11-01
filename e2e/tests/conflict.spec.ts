import { expect, test } from '@playwright/test'
import { apiAs, freeCreation, signUp } from '../support/users'

// T-31 e T-12 (QAW-19, QAW-20): o narrador salva o Senhor enquanto o jogador
// tem um rascunho de 7 alterações. Antes, o lote inteiro era recusado, a faixa
// culpava os 7 com o texto espremido em ~25 px, e "Reaplicar" sobrescrevia o
// valor do narrador sem mostrá-lo.

test.use({ viewport: { width: 390, height: 844 } })

test('conflito no Senhor: só ele fica marcado, com os dois valores; as outras 6 se salvam', async ({
  browser,
  page,
}) => {
  const desk = await browser.newContext()
  const storyteller = await signUp(desk, 'narra_conflito')
  const chronicle = await apiAs<{ id: string }>(
    desk,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica do conflito', systemCode: 'vtm-v20' }
  )
  await freeCreation(desk, storyteller, chronicle.id)
  const { code } = await apiAs<{ code: string }>(
    desk,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`
  )
  const context = page.context()
  const player = await signUp(context, 'joga_conflito')
  await apiAs(context, player, 'POST', '/invites/accept', { code })
  const character = await apiAs<{ id: string }>(
    context,
    player,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Isadora Vex', clan: 'tremere', sire: 'Anônimo' } }
  )

  // O jogador monta um rascunho de 7 alterações, com o Senhor
  await page.goto(`/characters/${character.id}?mode=evolve`)
  await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
  for (const trait of [
    'Força',
    'Destreza',
    'Vigor',
    'Carisma',
    'Manipulação',
    'Raciocínio',
  ])
    await page
      .getByRole('button', { name: `Aumentar ${trait}`, exact: true })
      .click()
  await page.getByRole('button', { name: /^Senhor: / }).click()
  await page.getByLabel('Senhor').fill('Meerlinda')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Editando · 7 alterações')).toBeVisible()

  // Enquanto isso, o narrador salva o Senhor
  const current = await apiAs<{ sheet: { values: { sire?: string } } }>(
    desk,
    storyteller,
    'GET',
    `/characters/${character.id}`
  )
  await apiAs(desk, storyteller, 'POST', `/characters/${character.id}/events`, {
    clientBatchId: crypto.randomUUID(),
    events: [
      { path: 'values.sire', from: current.sheet.values.sire, to: 'Etrius' },
    ],
  })

  await page.getByRole('button', { name: 'Concluir' }).click()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()

  // A faixa culpa só o Senhor e não reaplica às cegas
  const message = page.getByText(
    'Senhor foi alterado pelo narrador antes de a sua alteração chegar. As outras 6 continuam no rascunho.',
    { exact: false }
  )
  await expect(message).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reaplicar' })).toHaveCount(0)
  await expect(page.getByText('Editando · 7 alterações')).toBeVisible()

  // T-12: a 390 px, o texto fica legível e o botão desce para baixo dele
  const text = await message.boundingBox()
  const review = page.getByRole('button', { name: 'Revisar' })
  const button = await review.boundingBox()
  expect(text?.width ?? 0).toBeGreaterThanOrEqual(200)
  expect(button?.y ?? 0).toBeGreaterThanOrEqual(
    (text?.y ?? 0) + (text?.height ?? 0) - 1
  )

  // "Revisar": os dois valores, e a escolha na mesma linha
  await review.click()
  await expect(page.getByText('Seu valor: Meerlinda')).toBeVisible()
  await expect(
    page.getByText('Valor atual: Etrius · alterado pelo narrador')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Ficar com o atual' }).click()
  await expect(page.getByText('A ficha mudou em outro lugar')).toHaveCount(0)

  // As outras 6 se salvam; o Senhor do narrador fica
  await page.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.getByText('Salvar 6 alterações?')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect
    .poll(async () => {
      const saved = await apiAs<{
        sheet: { values: { sire?: string; strength?: number } }
      }>(context, player, 'GET', `/characters/${character.id}`)
      return [saved.sheet.values.sire, saved.sheet.values.strength]
    })
    .toEqual(['Etrius', 2])
  await desk.close()
})
