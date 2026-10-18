import { expect, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// Etapa 18: criar → evoluir (atributos, habilidades e disciplinas) → salvar
// → recarregar → os valores continuam lá. No web o Stepper tem botões de
// verdade ("Aumentar Força").
test('criar, evoluir, salvar e recarregar', async ({ page }) => {
  const context = page.context()
  const user = await signUp(context, 'evolui')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica de Evoluir', systemCode: 'vtm-v20' }
  )

  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page.getByLabel('Nome (obrigatório)').fill('Helena Varga')
  await page.getByRole('radio', { name: 'Tremere' }).click()
  await page.getByRole('button', { name: 'Criar ficha' }).click()

  // A ficha nova abre em Evoluir
  await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}\?mode=evolve$/)
  const id = /characters\/([0-9a-f-]{36})/.exec(page.url())?.[1]
  await expect(page.getByText('Evoluindo · 0 alterações')).toBeVisible()

  // Ficha nova: Força 1 (o mínimo) → 2
  await page
    .getByRole('button', { name: 'Aumentar Força', exact: true })
    .click()
  await expect(page.getByText('Evoluindo · 1 alteração')).toBeVisible()
  // Em Evoluir o filtro "Só com pontos" some: dá para comprar o 1º ponto
  await expect(page.getByRole('switch', { name: 'Só com pontos' })).toHaveCount(
    0
  )
  await page
    .getByRole('button', { name: 'Aumentar Ocultismo', exact: true })
    .click()
  await expect(page.getByText('Evoluindo · 2 alterações')).toBeVisible()

  await page.getByRole('tab', { name: 'Vantagens' }).click()
  await expect(page.getByText('Nenhuma Disciplina')).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar Disciplina' }).click()
  await page.getByLabel('Buscar Disciplina').fill('tauma')
  await page.getByRole('button', { name: 'Taumaturgia', exact: true }).click()
  await expect(page.getByText('Evoluindo · 3 alterações')).toBeVisible()

  await page.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.getByText('Salvar 3 alterações?')).toBeVisible()
  const saved = page.waitForResponse(
    r =>
      r.url().endsWith(`/characters/${id}/events`) &&
      r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByText('Salvo: 3 alterações')).toBeVisible()

  // Recarregar (sem rascunho, sem aviso do navegador): a dona abre em Jogo
  await page.goto(`/characters/${id}`)
  await expect(page.getByRole('radio', { name: 'Jogo' })).toBeChecked()
  await expect(page.getByLabel('Força, 2 de 5')).toBeVisible()
  await expect(page.getByLabel(/^Ocultismo, 1 de 5/)).toBeVisible()
  await page.getByRole('tab', { name: 'Vantagens' }).click()
  await expect(page.getByLabel('Taumaturgia, 1 de 5')).toBeVisible()
})

test('sair com rascunho pede confirmação', async ({ page }) => {
  const context = page.context()
  const user = await signUp(context, 'rascunho')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica', systemCode: 'vtm-v20' }
  )
  const character = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Nova' } }
  )
  await page.goto(`/characters/${character.id}?mode=evolve`)
  await page
    .getByRole('button', { name: 'Aumentar Força', exact: true })
    .click()
  await page.getByRole('button', { name: 'Voltar para Crônica' }).click()
  await expect(page.getByText('Sair sem salvar?')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(page.getByText('Evoluindo · 1 alteração')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar para Crônica' }).click()
  await page.getByRole('button', { name: 'Descartar e sair' }).click()
  await expect(page).toHaveURL(new RegExp(`/chronicles/${chronicle.id}$`))
})
