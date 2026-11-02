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

// T-56 (QAW-11): voltar com o formulário preenchido descartava sem perguntar
test('voltar da Nova ficha preenchida pergunta antes de descartar', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'guarda')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica da guarda', systemCode: 'vtm-v20' }
  )
  await page.goto(`/chronicles/${chronicle.id}`)
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  await page.getByLabel('Nome (obrigatório)').fill('Isadora Vex')
  await page
    .getByRole('button', { name: 'Voltar para Crônica da guarda' })
    .click()
  await expect(page.getByText('Sair sem salvar?')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar editando' }).click()
  await expect(page.getByLabel('Nome (obrigatório)')).toHaveValue('Isadora Vex')
  await page
    .getByRole('button', { name: 'Voltar para Crônica da guarda' })
    .click()
  await page.getByRole('button', { name: 'Descartar e sair' }).click()
  await expect(page).toHaveURL(new RegExp(`/chronicles/${chronicle.id}$`))
})

// T-02 (QAW-08): dois cliques rápidos em "Criar ficha" criavam duas fichas
test('clique duplo em "Criar ficha" cria uma ficha só', async ({ page }) => {
  const context = page.context()
  const user = await signUp(context, 'duplo_ficha')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica do clique duplo', systemCode: 'vtm-v20' }
  )
  const posts: string[] = []
  page.on('request', request => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith(`/chronicles/${chronicle.id}/characters`)
    )
      posts.push(request.url())
  })
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page.getByLabel('Nome (obrigatório)').fill('Isadora Vex QA Pontos')
  await page.getByRole('button', { name: 'Criar ficha' }).dblclick()
  await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}(\?mode=create)?$/)
  expect(posts).toHaveLength(1)
  const list = await apiAs<{ name: string }[]>(
    context,
    user,
    'GET',
    `/chronicles/${chronicle.id}/characters`
  )
  expect(list.filter(c => c.name === 'Isadora Vex QA Pontos')).toHaveLength(1)
})
