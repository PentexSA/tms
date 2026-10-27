import { expect, test } from '@playwright/test'
import { API_URL, WEB_URL } from '../env'
import { apiAs, freeCreation, signUp } from '../support/users'

// Etapa 22: excluir a conta (LGPD art. 18). Senha errada não exclui; com a
// senha, a conta sai, o cookie do refresh some, o login avisa e a conta não
// entra mais.
const PASSWORD = 'correct horse battery staple'

test('excluir a conta: senha errada não exclui; com a senha, não entra mais', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'sair')
  // Uma crônica só dela, com a própria ficha: sai junto com a conta
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica solo', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, user, chronicle.id)
  await apiAs(context, user, 'POST', `/chronicles/${chronicle.id}/characters`, {
    values: { name: 'Helena Varga' },
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Conta', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Conta', exact: true })
  ).toBeVisible()

  await page.getByLabel('Senha', { exact: true }).fill('senha errada qualquer')
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await expect(page.getByText('Senha incorreta.')).toBeVisible()

  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Excluir conta' }).click()
  await expect(page).toHaveURL(/\/login\?deleted=1$/)
  await expect(page.getByText('Conta excluída')).toBeVisible()

  // O cookie do refresh saiu junto
  const cookies = await context.cookies(`${API_URL}/auth`)
  expect(cookies.find(c => c.name === 'tms_refresh')?.value ?? '').toBe('')

  // A conta não entra mais, nem pela API
  const login = await context.request.post(`${API_URL}/auth/login`, {
    data: { email: `${user.username}@example.test`, password: PASSWORD },
    headers: { origin: WEB_URL },
  })
  expect(login.status()).toBe(401)

  await page.getByLabel('E-mail').fill(`${user.username}@example.test`)
  await page.getByLabel('Senha', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toContainText('e-mail ou senha')
})
