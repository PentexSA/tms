import { expect, type Page, test } from '@playwright/test'
import { API_URL } from '../env'
import { apiAs, freeCreation, signUp } from '../support/users'

// P06 da onda 1: teclado e foco no web (react-native-web), com a CSP de
// produção. O foco vai direto ao elemento com locator.focus(): o Tab do
// WebKit pula botões por padrão no macOS, e o que se testa aqui são as
// teclas a partir do elemento focado.

async function sheetInEvolve(page: Page, prefix: string) {
  const context = page.context()
  const user = await signUp(context, prefix)
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica do teclado', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, user, chronicle.id)
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page.getByLabel('Nome (obrigatório)').fill('Vera Lúcida')
  await page.getByRole('radio', { name: 'Tremere' }).click()
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
  const id = /characters\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? ''
  return { context, user, chronicle, id }
}

test('T-35: rádios da Nova ficha com setas (sem escolher) e Espaço', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'radios')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica', systemCode: 'vtm-v20' }
  )
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  // T-09: o grupo tem título visível
  await expect(page.getByText('Clã', { exact: true })).toBeVisible()
  const clans = page.getByRole('radiogroup', { name: 'Clã' }).getByRole('radio')
  const first = clans.nth(0)
  const second = clans.nth(1)
  await first.focus()
  await page.keyboard.press('ArrowDown')
  await expect(second).toBeFocused()
  // Ativação manual: a seta não escolhe
  await expect(second).not.toBeChecked()
  await page.keyboard.press(' ')
  await expect(second).toBeChecked()
})

test('T-35 e T-71: abas com setas e Espaço; Esc devolve o foco; um Fechar', async ({
  page,
}) => {
  await sheetInEvolve(page, 'abas')
  const ficha = page.getByRole('tab', { name: 'Ficha', exact: true })
  const vantagens = page.getByRole('tab', { name: 'Vantagens' })
  await ficha.focus()
  // Ativação automática: a seta já seleciona
  await page.keyboard.press('ArrowRight')
  await expect(vantagens).toBeFocused()
  await expect(vantagens).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Home')
  await expect(ficha).toHaveAttribute('aria-selected', 'true')
  await vantagens.focus()
  await page.keyboard.press(' ')
  await expect(vantagens).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toBeVisible()

  const add = page.getByRole('button', { name: 'Adicionar Antecedente' })
  await add.focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('dialog').or(page.locator('[aria-modal]'))
  ).toBeVisible()
  // T-71: o fundo não é um segundo "Fechar"
  await expect(page.getByRole('button', { name: 'Fechar' })).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(add).toBeFocused()
})

test('T-25: Digitar aplica ao sair, um campo por vez, recusa decimal', async ({
  page,
}) => {
  await sheetInEvolve(page, 'digitar')
  await page.getByRole('button', { name: 'Digitar Destreza' }).click()
  await page.getByLabel('Destreza, de 1 a 5').fill('3')
  // Abrir o Vigor aplica a Destreza e fecha o campo dela
  await page.getByRole('button', { name: 'Digitar Vigor' }).click()
  await expect(page.getByLabel(/, de 1 a 5$/)).toHaveCount(1)
  await expect(page.getByText('Editando · 1 alteração')).toBeVisible()
  // Tab para fora aplica também
  await page.getByLabel('Vigor, de 1 a 5').fill('2')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel(/, de 1 a 5$/)).toHaveCount(0)
  await expect(page.getByText('Editando · 2 alterações')).toBeVisible()

  await page.getByRole('button', { name: 'Digitar Força' }).click()
  await page.getByLabel('Força, de 1 a 5').fill('3.5')
  await page.keyboard.press('Enter')
  await expect(
    page.getByText('Digite um número inteiro de 1 a 5')
  ).toBeVisible()
  // Esc fecha sem aplicar, tira a mensagem e devolve o foco ao "Digitar"
  await page.keyboard.press('Escape')
  await expect(page.getByText('Editando · 2 alterações')).toBeVisible()
  await expect(page.getByText('Digite um número inteiro de 1 a 5')).toHaveCount(
    0
  )
  const typeStrength = page.getByRole('button', { name: 'Digitar Força' })
  await expect(typeStrength).toBeFocused()
  // Enter válido também devolve o foco ao botão
  await typeStrength.click()
  await page.getByLabel('Força, de 1 a 5').fill('2')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Editando · 3 alterações')).toBeVisible()
  await expect(typeStrength).toBeFocused()
})

test('T-42: "Oculta" da Mesa é um interruptor ligado que desliga', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'oculta')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica da mesa', systemCode: 'vtm-v20' }
  )
  await page.goto(`/chronicles/${chronicle.id}`)
  await page.getByRole('tab', { name: 'Mesa' }).click()
  const hidden = page.getByRole('switch', { name: 'Oculta' })
  await expect(hidden).toBeChecked()
  await hidden.focus()
  await page.keyboard.press(' ')
  await expect(hidden).not.toBeChecked()
})

test('T-72: restauração lenta mostra a app bar e "Carregando"', async ({
  page,
}) => {
  const { id } = await sheetInEvolve(page, 'lento')
  await page.route(`${API_URL}/auth/refresh`, async route => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    await route.continue()
  })
  await page.goto(`/characters/${id}`)
  await expect(page.getByRole('status')).toContainText('Carregando')
  await expect(page.getByRole('heading', { name: 'TMS' })).toBeVisible()
  await page.unroute(`${API_URL}/auth/refresh`)
})
