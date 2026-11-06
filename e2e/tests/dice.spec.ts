import { randomUUID } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { apiAs, completeCreation, freeCreation, signUp } from '../support/users'

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
  await freeCreation(context, user, chronicle.id)
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
  // Ficha em uso: a dona abre em Jogo (em criação, abriria em Editar, T-05).
  // Na criação livre, quem conclui é o narrador (aqui, a mesma pessoa)
  await completeCreation(context, user, character.id)

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

/** Uma ficha concluída do sistema, aberta em Jogo pela dona. */
async function playing(page: Page, systemCode: string, name: string) {
  const context = page.context()
  const user = await signUp(context, 'dados_p13')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica dos Dados', systemCode }
  )
  await freeCreation(context, user, chronicle.id)
  const character = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name } }
  )
  await completeCreation(context, user, character.id)
  return { context, user, id: character.id }
}

test.describe('P13 a 390', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // T-79: o resultado sai do topo quando a parada muda; o W20 separa "Em jogo"
  test('trocar o Atributo tira o resultado do topo; no W20, "Atributos" e "Em jogo"', async ({
    page,
  }) => {
    const { id } = await playing(page, 'wta-w20', 'Iara')
    await page.goto(`/characters/${id}`)
    await page.getByRole('button', { name: 'Dados', exact: true }).click()
    await page.getByRole('button', { name: /^Atributo:/ }).click()
    await expect(
      page.getByRole('heading', { name: 'Em jogo', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Atributos', exact: true })
    ).toBeVisible()
    await page.getByLabel('Buscar atributo').fill('destreza')
    await page.getByRole('button', { name: /^Destreza, / }).click()
    await page.getByRole('button', { name: 'Rolar no app' }).click()
    const faces = page.getByText(/^Dados: /)
    await expect(faces).toBeVisible()
    await page.getByRole('button', { name: /^Atributo:/ }).click()
    await page.getByLabel('Buscar atributo').fill('força')
    await page
      .getByRole('button', { name: /^Força, / })
      .first()
      .click()
    await expect(faces).toHaveCount(0)
    await expect(page.getByText('Nesta sessão')).toBeVisible()
  })

  // T-77: o narrador nunca é barrado pela trava. Aqui a mesma conta é dona e
  // narradora; o caso da dona barrada, com o aria-disabled sem `disabled`,
  // está no DiceSheet.test.tsx (o web pelo Platform.OS)
  test('ficha travada: o narrador continua ligando "Gastar 1 Força de Vontade"', async ({
    page,
  }) => {
    const { context, user, id } = await playing(page, 'vtm-v20', 'Helena')
    await apiAs(context, user, 'POST', `/characters/${id}/lock`)
    await page.goto(`/characters/${id}`)
    await page.getByRole('button', { name: 'Dados', exact: true }).click()
    const boost = page.getByRole('checkbox', { name: /^Gastar 1 Força/ })
    await expect(boost).not.toHaveAttribute('aria-disabled', 'true')
  })
})
