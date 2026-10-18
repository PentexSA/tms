import { expect, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// Etapa 14: a ficha nasce pelo formulário gerado do template e abre.
test('criar a ficha pela identidade e abri-la', async ({ page }) => {
  const context = page.context()
  const user = await signUp(context, 'helena')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    {
      name: 'Crônica da Liberdade',
      systemCode: 'vtm-v20',
    }
  )

  await page.goto(`/chronicles/${chronicle.id}`)
  await expect(page.getByText('Nenhuma ficha ainda.')).toBeVisible()
  await page.getByRole('button', { name: 'Nova ficha' }).click()

  await page.getByLabel('Nome (obrigatório)').fill('Helena Varga')
  await page.getByLabel('Conceito').fill('Arquivista da Capela')
  await page.getByRole('radio', { name: 'Tremere' }).click()
  await expect(page.getByRole('radio', { name: 'Tremere' })).toBeChecked()
  // No web, o Stepper tem botões de verdade
  await page.getByRole('button', { name: 'Diminuir Geração' }).click()
  await page.getByRole('button', { name: 'Diminuir Geração' }).click()
  await page.getByRole('button', { name: 'Criar ficha' }).click()

  // A ficha nova abre em Evoluir (Etapa 18)
  await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}(\?mode=evolve)?$/)
  await expect(
    page.getByRole('heading', { name: 'Helena Varga' })
  ).toBeVisible()
  // Em Evoluir, o Clã aparece no editor, com "Trocar"
  await expect(page.getByRole('button', { name: 'Clã: Tremere' })).toBeVisible()
  // A geração escolhida (11ª) aparece no Sangue derivado: 12 pontos, no
  // editor do atual em Evoluir
  await expect(
    page.getByRole('group', { name: 'Pontos de Sangue atual' })
  ).toContainText('12')

  await page
    .getByRole('button', { name: 'Voltar para Crônica da Liberdade' })
    .click()
  await expect(
    page.getByRole('button', { name: /^Helena Varga, / })
  ).toBeVisible()
})

test('sem nome não cria', async ({ page }) => {
  const context = page.context()
  const user = await signUp(context, 'sem_nome')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    {
      name: 'Crônica',
      systemCode: 'vtm-v20',
    }
  )
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page.getByRole('alert')).toContainText('Informe o nome')
  await expect(page).toHaveURL(/new-character$/)
})
