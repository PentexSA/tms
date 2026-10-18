import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// Etapa 21: montar Destreza + Esportes no sheet "Dados" e rolar. Quem rola é
// o servidor; a tela mostra o resultado e a parada que saiu da ficha.
test('montar Destreza + Esportes e rolar', async ({ page }) => {
  const context = page.context()
  const user = await signUp(context, 'dados')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica dos Dados', systemCode: 'vtm-v20' }
  )
  const character = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Helena Varga', clan: 'tremere' } }
  )
  // Destreza 3 e Esportes 2, pelo mesmo endpoint de lotes do app
  await apiAs(context, user, 'POST', `/characters/${character.id}/events`, {
    clientBatchId: randomUUID(),
    events: [
      { path: 'values.dexterity', from: null, to: 3 },
      { path: 'values.athletics', from: null, to: 2 },
    ],
  })

  await page.goto(`/characters/${character.id}`)
  await page.getByRole('button', { name: 'Dados', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dados' })).toBeVisible()

  // Nome exato: a ficha atrás do sheet também tem "Destreza, 3 de 5"
  await page.getByRole('button', { name: /^Atributo:/ }).click()
  await page.getByLabel('Buscar atributo').fill('destreza')
  await page.getByRole('button', { name: 'Destreza, 3', exact: true }).click()
  await page.getByRole('button', { name: /^Habilidade ou Disciplina:/ }).click()
  await page.getByLabel('Buscar habilidade ou disciplina').fill('esportes')
  await page.getByRole('button', { name: 'Esportes, 2', exact: true }).click()
  await expect(page.getByLabel('Parada: 5 dados')).toBeVisible()

  await page.getByRole('button', { name: 'Rolar no app' }).click()
  // O resultado do servidor: N sucessos, Falha ou Falha crítica, e 5 dados
  await expect(
    page.getByText(/^(\d+ sucessos?|Falha|Falha crítica)$/)
  ).toBeVisible()
  await expect(page.getByText(/^Dados: (\d+ · ){4}\d+$/)).toBeVisible()

  // A rolagem ficou no servidor
  const rolls = await apiAs<{ items: { label: string; manual: boolean }[] }>(
    context,
    user,
    'GET',
    `/characters/${character.id}/rolls`
  )
  expect(rolls.items).toEqual([
    expect.objectContaining({ label: 'Destreza + Esportes', manual: false }),
  ])
})
