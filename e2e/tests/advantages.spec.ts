import { expect, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// P07-C (onda 2): as folhas das Vantagens na criação por pontos do V20, no
// celular. A recusa da conta aparece dentro da folha tocada (T-19), o Enter
// adiciona (T-62), o Defeito entra no saldo com o bônus que a folha mostra
// (T-23) e cada bloco tem um título e um contador (T-58). A frase da recusa
// é do P05-C: o spec busca o papel `alert` e o rótulo do grupo.
test.use({ viewport: { width: 390, height: 844 } })

test('Vantagens a 390 px: recusa na folha, Enter, Defeito no saldo e títulos', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'vantagens')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica das Vantagens', systemCode: 'vtm-v20' }
  )

  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page.getByLabel('Nome (obrigatório)').fill('Isadora Vex')
  await page.getByRole('radio', { name: 'Tremere' }).click()
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page.getByRole('tab', { name: 'Orçamento' })).toBeVisible()
  await page.getByRole('tab', { name: 'Vantagens' }).click()

  // T-58: um título e um contador por bloco
  await expect(
    page.getByRole('heading', { name: 'Disciplinas', exact: true })
  ).toHaveCount(1)
  await expect(page.getByTestId('counter-disciplines')).toHaveText('0/3')
  await expect(
    page.getByRole('heading', { name: 'Defeitos', exact: true })
  ).toHaveCount(1)

  const sheet = page.getByRole('dialog').or(page.locator('[aria-modal]'))
  const add = page.getByRole('button', { name: 'Adicionar Disciplina' })
  for (const [query, name] of [
    ['ausp', 'Auspícios'],
    ['domin', 'Dominação'],
    ['fortit', 'Fortitude'],
  ] as const) {
    await add.click()
    await page.getByLabel('Buscar Disciplina').fill(query)
    await page.getByRole('button', { name, exact: true }).click()
    await expect(sheet).toHaveCount(0)
  }
  await expect(page.getByTestId('counter-disciplines')).toHaveText('3/3')

  // T-19: a 4ª Disciplina em Pontos básicos avisa dentro da folha
  await add.click()
  await page.getByLabel('Buscar Disciplina').fill('ofusc')
  await page.getByRole('button', { name: 'Ofuscação', exact: true }).click()
  await expect(sheet.first().getByRole('alert')).toContainText('Disciplinas')
  await expect(
    page.getByTestId('editor-disciplines').getByRole('alert')
  ).toHaveCount(0)
  // Esc fecha; o foco volta ao gatilho (T-71) e nada sobra na ficha
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(add).toBeFocused()
  await expect(page.getByRole('alert')).toHaveCount(0)

  // T-62 e T-23: Enter adiciona o Defeito, com o Bônus 1 que a folha mostra
  // Cada folha pelo testID: a anterior ainda sai (animação) quando a
  // próxima abre, e as duas têm um campo "Nome"
  await page.getByRole('button', { name: 'Adicionar Defeito' }).click()
  await page
    .getByTestId('add-sheet-flaws')
    .getByRole('textbox', { name: 'Nome', exact: true })
    .fill('Inimigo')
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: /^Inimigo, Bônus 1/ })
  ).toBeVisible()

  // A Qualidade entra com o Custo 1 do template, paga com bônus
  await page.getByRole('button', { name: 'Adicionar Qualidade' }).click()
  await page
    .getByTestId('add-sheet-merits')
    .getByRole('textbox', { name: 'Nome', exact: true })
    .fill('Ambidestro')
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('button', { name: /^Ambidestro, Custo 1/ })
  ).toBeVisible()

  // O crédito do Defeito entra no saldo: 15 + 1, menos 1 da Qualidade
  await page.getByRole('tab', { name: 'Orçamento' }).click()
  await expect(page.getByTestId('creation-freebies')).toContainText(
    /\b15 de 16\b/
  )
})
