import { expect, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// Etapa 11: o narrador cria a crônica e o convite; o jogador entra com o
// código; os dois veem a mesma mesa.
test('narrador convida e o jogador entra com o código', async ({
  browser,
  page,
}) => {
  const storyteller = await signUp(page.context(), 'narra')
  await page.goto('/')
  await expect(
    page.getByRole('heading', {
      name: 'Você ainda não participa de nenhuma crônica',
    })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Criar crônica' }).click()
  await page.getByLabel('Nome da crônica').fill('Crônica da Liberdade')
  // Com Vampiro e Mago publicados, o sistema é escolhido (v1)
  const vampire = page.getByRole('radio', { name: /Vampiro: A Máscara/ })
  await vampire.click()
  await expect(vampire).toBeChecked()
  await page.getByRole('button', { name: 'Criar crônica' }).click()
  await expect(
    page.getByRole('heading', { name: 'Crônica da Liberdade' })
  ).toBeVisible()
  await expect(page.getByText('Você narra esta crônica.')).toBeVisible()

  await page.getByRole('button', { name: 'Convidar' }).click()
  await page.getByRole('button', { name: 'Gerar convite' }).click()
  const code = (await page.getByTestId('invite-code-value').innerText()).trim()
  expect(code).toMatch(/^[0-9A-Z ]{30,32}$/)
  await expect(page.getByText(/10 usos restantes/)).toBeVisible()

  // O jogador, em outro navegador, entra com o código digitado em minúsculas
  const other = await browser.newContext()
  const playerPage = await other.newPage()
  const player = await signUp(other, 'joga')
  await playerPage.goto('/')
  await playerPage.getByRole('button', { name: 'Entrar com convite' }).click()
  await playerPage.getByLabel('Código do convite').fill(code.toLowerCase())
  await playerPage.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(
    playerPage.getByText(`Narrador: ${storyteller.username}`, { exact: true })
  ).toBeVisible()
  await expect(
    playerPage.getByRole('button', { name: 'Convidar' })
  ).toHaveCount(0)

  await playerPage.getByRole('button', { name: 'Voltar para Crônicas' }).click()
  await expect(
    playerPage.getByRole('button', {
      name: new RegExp(
        `Crônica da Liberdade.*Narrador: ${storyteller.username}`
      ),
    })
  ).toBeVisible()

  // O narrador vê o jogador na mesa
  await page.reload()
  await expect(page.getByText(player.username, { exact: true })).toBeVisible()
  await other.close()
})

test('código inválido não entra em crônica nenhuma', async ({ page }) => {
  await signUp(page.context(), 'curioso')
  await page.goto('/join')
  await page
    .getByLabel('Código do convite')
    .fill('0000 0000 0000 0000 0000 0000 00')
  await page.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'convite inválido ou expirado'
  )
})

// T-02 (QAW-08): dois cliques rápidos em "Criar crônica" criavam duas crônicas
test('clique duplo em "Criar crônica" cria uma crônica só', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'duplo_cronica')
  const posts: string[] = []
  page.on('request', request => {
    if (request.method() === 'POST' && /\/chronicles$/.test(request.url()))
      posts.push(request.url())
  })
  await page.goto('/chronicles/new')
  await page.getByLabel('Nome da crônica').fill('Crônica do clique duplo')
  await page.getByRole('radio', { name: /Vampiro: A Máscara/ }).click()
  await page.getByRole('button', { name: 'Criar crônica' }).dblclick()
  await expect(
    page.getByRole('heading', { name: 'Crônica do clique duplo' })
  ).toBeVisible()
  expect(posts).toHaveLength(1)
  const list = await apiAs<{ name: string }[]>(
    context,
    user,
    'GET',
    '/chronicles'
  )
  expect(list.filter(c => c.name === 'Crônica do clique duplo')).toHaveLength(1)
})

// T-74: "nenhuma transferência" era 404, um erro de recurso no console a cada
// vez que os Bastidores abriam
test('abrir os Bastidores sem transferência não gera 4xx de /transfer', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'narra')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica sem Transferência', systemCode: 'vtm-v20' }
  )
  const statuses: number[] = []
  page.on('response', res => {
    if (new URL(res.url()).pathname.endsWith('/transfer'))
      statuses.push(res.status())
  })
  await page.goto(`/chronicles/${chronicle.id}`)
  await page.getByRole('tab', { name: 'Bastidores' }).click()
  await expect(page.getByText('Diário da crônica')).toBeVisible()
  await expect(page.getByText('Transferir narração')).toBeVisible()
  await expect.poll(() => statuses.length).toBeGreaterThan(0)
  expect(statuses.every(status => status < 400)).toBe(true)
})
