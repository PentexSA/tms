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
  await expect(
    page.getByRole('tab', { name: /^Pontos(, a seguir)?$/ })
  ).toBeVisible()
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
  // Auspícios e Dominação são do clã (Tremere): o selo entra no nome
  for (const [query, name] of [
    ['ausp', 'Auspícios, do clã'],
    ['domin', 'Dominação, do clã'],
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

  // P07-D, R-25: o "+" da linha, com o grupo cheio, avisa na própria linha
  // (sem folha). No DOM, aria-disabled e nunca disabled (lição e8cfaf8)
  const plus = page.getByRole('button', {
    name: 'Aumentar Auspícios',
    exact: true,
  })
  const minus = page.getByRole('button', {
    name: 'Diminuir Auspícios',
    exact: true,
  })
  await expect(plus).toHaveAttribute('aria-disabled', 'true')
  await expect(plus).not.toHaveAttribute('disabled')
  // O Playwright não clica em aria-disabled sem force (o creation-feedback faz igual)
  await plus.click({ force: true })
  await expect(sheet).toHaveCount(0)
  await expect(page.getByTestId('notice-disciplines-i1')).toBeVisible()
  await expect(page.getByTestId('notice-disciplines-i2')).toHaveCount(0)
  await expect(page.getByTestId('counter-disciplines')).toHaveText('3/3')
  for (const control of [plus, minus]) {
    const box = await control.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
  }
  // R-26: a Fortitude não é do Tremere: a linha avisa, sem bloquear
  await expect(page.getByTestId('identity-disciplines-i3')).toContainText(
    'fora do clã: confirme com o narrador'
  )

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
  await page.getByRole('tab', { name: /^Pontos(, a seguir)?$/ }).click()
  await expect(page.getByTestId('creation-freebies')).toContainText(
    /\b15 de 16\b/
  )
  // O "fora do clã" fica para o narrador, fora do "O que falta"
  await expect(page.getByTestId('creation-notices')).toContainText(
    'Disciplinas: 1 fora do clã.'
  )
})

test('R-26 a 390 px: Brujah, as do clã primeiro, e Dominação de fora', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'brujah')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica do Clã', systemCode: 'vtm-v20' }
  )
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page.getByLabel('Nome (obrigatório)').fill('Teo Brasa')
  await page.getByRole('radio', { name: 'Brujah' }).click()
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await page.getByRole('tab', { name: 'Vantagens' }).click()
  await page.getByRole('button', { name: 'Adicionar Disciplina' }).click()
  const sheet = page.getByTestId('add-sheet-disciplines')
  await expect(sheet.getByRole('button', { name: /, do clã$/ })).toHaveCount(3)
  await expect(
    sheet.getByRole('heading', { name: 'Do clã', exact: true })
  ).toBeVisible()
  await sheet.getByRole('button', { name: 'Dominação', exact: true }).click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByTestId('identity-disciplines-i1')).toContainText(
    'fora do clã: confirme com o narrador'
  )
  // Nada bloqueou: o ponto entrou e a conta seguiu
  await expect(page.getByTestId('counter-disciplines')).toHaveText('1/3')
})
