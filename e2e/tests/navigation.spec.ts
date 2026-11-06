import { expect, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// P12, T-30: o "‹" sem tela de baixo (F5, link direto) não fazia nada, e o
// console mostrava o GO_BACK sem navegador. Achado 6 (d): a troca de aba da
// crônica empilha no histórico do navegador?

test('o "‹" sai depois de um link direto, sem GO_BACK no console', async ({
  page,
}) => {
  const user = await signUp(page.context(), 'volta')
  const chronicle = await apiAs<{ id: string }>(
    page.context(),
    user,
    'POST',
    '/chronicles',
    { name: 'Cronica da Volta', systemCode: 'vtm-v20' }
  )
  const console: string[] = []
  page.on('console', m => console.push(m.text()))

  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page
    .getByRole('button', { name: 'Voltar para Cronica da Volta' })
    .click()
  await expect(page).toHaveURL(new RegExp(`/chronicles/${chronicle.id}$`))

  for (const path of ['/join', '/chronicles/new']) {
    await page.goto(path)
    await page.getByRole('button', { name: 'Voltar para Crônicas' }).click()
    await expect(page).toHaveURL(/\/$/)
  }
  expect(console.some(text => text.includes('GO_BACK'))).toBe(false)
})

test('achado 6 (d): trocar de aba e o voltar do navegador', async ({
  page,
}) => {
  const user = await signUp(page.context(), 'abas')
  const chronicle = await apiAs<{ id: string }>(
    page.context(),
    user,
    'POST',
    '/chronicles',
    { name: 'Cronica das Abas', systemCode: 'vtm-v20' }
  )
  await page.goto('/')
  await page.getByText('Cronica das Abas').click()
  await expect(page).toHaveURL(new RegExp(`/chronicles/${chronicle.id}`))
  const before = await page.evaluate(() => history.length)
  for (const tab of ['Mesa', 'Fichas', 'Mesa'])
    await page.getByRole('tab', { name: tab }).click()
  const after = await page.evaluate(() => history.length)
  // Registra o comportamento de hoje: o setParams substitui a entrada (o
  // voltar sai da crônica). Se empilhar, este teste falha e a correção é a
  // da hipótese (d) do plano (P12 §3.4)
  expect(after).toBe(before)
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
})
