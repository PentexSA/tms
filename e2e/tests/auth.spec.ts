import { expect, test } from '@playwright/test'

// Etapa 9: cadastro, sessão pelo cookie HttpOnly (sobrevive ao recarregar),
// logout e login. Um usuário novo por teste e por navegador.
const unique = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`

test('cadastro, recarregar, sair e entrar de novo', async ({ page }) => {
  const id = unique()
  const user = {
    email: `ana-${id}@example.test`,
    username: `ana_${id}`.slice(0, 24),
    password: 'correct horse battery staple',
  }

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await page.getByLabel('E-mail').fill(user.email)
  await page.getByLabel('Nome de usuário').fill(user.username)
  await page.getByLabel('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page.getByText(`Olá, ${user.username}`)).toBeVisible()
  await expect(page.getByText('API online')).toBeVisible()

  // O refresh token mora num cookie HttpOnly: o JavaScript não lê
  const cookies = await page.context().cookies('http://localhost:3101/auth')
  const refresh = cookies.find(c => c.name === 'tms_refresh')
  expect(refresh?.httpOnly).toBe(true)
  expect(refresh?.sameSite).toBe('Strict')
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'tms_refresh'
  )
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'refresh'
  )

  // Recarregar mantém a sessão (o app renova pelo cookie)
  await page.reload()
  await expect(page.getByText(`Olá, ${user.username}`)).toBeVisible()

  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('E-mail').fill(user.email.toUpperCase())
  await page.getByLabel('Senha').fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText(`Olá, ${user.username}`)).toBeVisible()
})

test('senha errada mostra o erro genérico', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('ninguem@example.test')
  await page.getByLabel('Senha').fill('qualquer senha errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText(
    'e-mail ou senha incorretos'
  )
})
