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
  // A Geração não está no formulário: sai do antecedente, em Editar
  await expect(page.getByRole('group', { name: /Geração/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Criar ficha' }).click()

  // O Vampiro tem criação por pontos: a ficha nova abre na Criação
  await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}(\?mode=create)?$/)
  await expect(
    page.getByRole('heading', { name: 'Helena Varga' })
  ).toBeVisible()
  // Em Editar, o Clã fica no cabeçalho em colunas, como na ficha impressa
  await expect(page.getByRole('button', { name: 'Clã: Tremere' })).toBeVisible()
  // Sem o antecedente Geração, a 13ª: o Sangue derivado tem 10 pontos, no
  // editor do atual em Editar
  await expect(
    page.getByRole('group', { name: 'Pontos de Sangue atual' })
  ).toContainText('10')

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
