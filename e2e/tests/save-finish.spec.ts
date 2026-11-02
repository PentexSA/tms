import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'
import {
  ALMOST,
  newCharacter,
  plus,
  pointsChronicle,
  prepared,
  type User,
} from '../support/creation'
import { apiAs, freeCreation, signUp } from '../support/users'

// P03-D (D-01): "Salvar" sempre na barra de Criação, com "Concluir criação"
// ou "Enviar para aprovação" ao lado (T-04); "Salvar e sair" no "Sair sem
// salvar?"; no Editar, "Salvar alterações" no lugar de "Concluir" (R-05).
// Salvar nunca conclui: a conclusão continua só no /creation/complete, que
// o servidor confere. Contas fictícias (signUp); a ficha vem quase pronta
// pela API (todos os pontos básicos menos 1 de Vigor).

test.use({ viewport: { width: 390, height: 844 } })

// O "Salvar" da barra: texto "Salvar", nome "Salvar alterações" (WCAG 2.5.3)
const barSave = (page: Page) =>
  page.getByRole('button', { name: 'Salvar alterações', exact: true })
// O "Salvar" do resumo
const summarySave = (page: Page) =>
  page.getByRole('button', { name: 'Salvar', exact: true })

/** Conta os POST …/creation/complete da página: salvar não conclui. */
function completions(page: Page) {
  let n = 0
  page.on('request', r => {
    if (r.method() === 'POST' && r.url().endsWith('/creation/complete')) n++
  })
  return () => n
}

const eventsSaved = (page: Page, id: string) =>
  page.waitForResponse(
    r =>
      r.url().endsWith(`/characters/${id}/events`) &&
      r.request().method() === 'POST'
  )

/** A ficha quase pronta, aberta em Criação, com o último ponto básico. */
async function almostDone(
  page: Page,
  context: BrowserContext,
  user: User,
  chronicleId: string
) {
  const character = await newCharacter(context, user, chronicleId)
  await prepared(context, user, character.id, ALMOST)
  await page.goto(`/characters/${character.id}?mode=create`)
  await plus(page, 'Vigor').click()
  await page.getByRole('button', { name: 'Entendi' }).click()
  return character.id
}

const box = async (locator: Locator) => {
  const b = await locator.boundingBox()
  if (!b) throw new Error('fora da tela')
  return b
}

test('T-04: "Salvar" ao lado de "Concluir criação"; salvar não conclui', async ({
  browser,
  page,
}) => {
  const context = page.context()
  const completed = completions(page)
  const { chronicleId, user } = await pointsChronicle(browser, context)
  const id = await almostDone(page, context, user, chronicleId)

  await expect(barSave(page)).toHaveText('Salvar')
  await expect(page.getByTestId('creation-action')).toHaveText(
    'Concluir criação'
  )
  // A 390, duas linhas: o texto em cima, os dois botões inteiros embaixo
  const text = await box(page.getByText(/^Criação · 1 alteração/))
  for (const button of [barSave(page), page.getByTestId('creation-action')]) {
    const b = await box(button)
    expect(b.x + b.width).toBeLessThanOrEqual(390)
    expect(b.y).toBeGreaterThanOrEqual(text.y + text.height)
  }

  await barSave(page).click()
  await expect(page.getByText('Salvar 1 alteração?')).toBeVisible()
  const saved = eventsSaved(page, id)
  await summarySave(page).click()
  expect((await saved).status()).toBe(200)
  await expect(
    page.getByRole('radio', { name: 'Criação', exact: true })
  ).toBeChecked()
  await expect(page.getByTestId('creation-action')).toHaveText(
    'Concluir criação'
  )
  expect(completed()).toBe(0)
})

test('T-04: com a aprovação ligada, "Enviar para aprovação" ao lado; salvar não envia', async ({
  browser,
  page,
}) => {
  const context = page.context()
  const completed = completions(page)
  const { chronicleId, user, storyteller } = await pointsChronicle(
    browser,
    context
  )
  await apiAs(
    context,
    storyteller,
    'PATCH',
    `/chronicles/${chronicleId}/creation-settings`,
    { revision: 0, approval: true }
  )
  const id = await almostDone(page, context, user, chronicleId)
  await expect(page.getByTestId('creation-action')).toHaveText(
    'Enviar para aprovação'
  )
  await barSave(page).click()
  const saved = eventsSaved(page, id)
  await summarySave(page).click()
  expect((await saved).status()).toBe(200)
  await expect(
    page.getByRole('radio', { name: 'Criação', exact: true })
  ).toBeChecked()
  expect(completed()).toBe(0)
})

test('T-04: "Salvar e sair" grava e sai; Esc fica na ficha', async ({
  browser,
  page,
}) => {
  const context = page.context()
  const completed = completions(page)
  const { chronicleId, user } = await pointsChronicle(browser, context)
  const id = await almostDone(page, context, user, chronicleId)
  // Mais um ponto, já na fase de bônus
  await plus(page, 'Força').click()
  await expect(page.getByText(/^Criação · 2 alterações/)).toBeVisible()

  // Esc fecha a folha e fica na ficha, com o rascunho
  const back = page.getByRole('button', { name: /^Voltar para / })
  await back.click()
  await expect(page.getByText('Sair sem salvar?')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Sair sem salvar?')).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/characters/${id}`))
  await expect(page.getByLabel(/^Sincronização: /)).toHaveAccessibleName(
    'Sincronização: 2 alterações não salvas'
  )

  // A 390, em coluna: "Descartar e sair" em cima, "Salvar e sair" embaixo
  await back.click()
  const discard = await box(
    page.getByRole('button', { name: 'Descartar e sair' })
  )
  const saveAndLeave = page.getByRole('button', { name: 'Salvar e sair' })
  expect((await box(saveAndLeave)).y).toBeGreaterThan(discard.y)
  const saved = eventsSaved(page, id)
  await saveAndLeave.click()
  expect((await saved).status()).toBe(200)
  await expect(page).toHaveURL(new RegExp(`/chronicles/${chronicleId}$`))
  await expect(page.getByText(/^Salvo: /)).toBeVisible()

  // Gravado, e a ficha continua em criação
  const sheet = await apiAs<{
    status: string
    sheet: { values: Record<string, unknown> }
  }>(context, user, 'GET', `/characters/${id}`)
  expect(sheet.status).toBe('creating')
  expect(sheet.sheet.values.stamina).toBe(3)
  expect(sheet.sheet.values.strength).toBe(5)
  expect(completed()).toBe(0)
})

test('R-05: no Editar, "Salvar alterações", desabilitado sem alterações, e nenhum "Concluir"', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'salva_livre')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica livre', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, user, chronicle.id)
  const character = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Otto', clan: 'tremere' } }
  )
  await page.goto(`/characters/${character.id}?mode=evolve`)
  const concluir = page.getByRole('button', { name: 'Concluir', exact: true })
  await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
  // O `disabled` do <button>: o Jest não renderiza o DOM
  await expect(barSave(page)).toBeDisabled()
  await expect(concluir).toHaveCount(0)

  await plus(page, 'Força').click()
  await expect(barSave(page)).toBeEnabled()
  await barSave(page).click()
  await expect(page.getByText('Salvar 1 alteração?')).toBeVisible()
  const saved = eventsSaved(page, character.id)
  await summarySave(page).click()
  expect((await saved).status()).toBe(200)
  await expect(page.getByRole('radio', { name: 'Jogo' })).toBeChecked()
  await expect(concluir).toHaveCount(0)
})

test.describe('a 1280', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('T-04: a barra numa linha; "Sair sem salvar?" com as três ações numa linha', async ({
    browser,
    page,
  }) => {
    const context = page.context()
    const { chronicleId, user } = await pointsChronicle(browser, context)
    await almostDone(page, context, user, chronicleId)
    const save = await box(barSave(page))
    const next = await box(page.getByTestId('creation-action'))
    expect(Math.abs(save.y - next.y)).toBeLessThanOrEqual(4)
    expect(save.x).toBeLessThan(next.x)

    await page.getByRole('button', { name: /^Voltar para / }).click()
    await expect(page.getByText('Sair sem salvar?')).toBeVisible()
    const discard = await box(
      page.getByRole('button', { name: 'Descartar e sair' })
    )
    const stay = await box(
      page.getByRole('button', { name: 'Continuar editando' })
    )
    const leave = await box(page.getByRole('button', { name: 'Salvar e sair' }))
    for (const b of [stay, leave])
      expect(Math.abs(b.y - discard.y)).toBeLessThanOrEqual(4)
    expect(discard.x).toBeLessThan(stay.x)
    expect(stay.x).toBeLessThan(leave.x)
    await page.getByRole('button', { name: 'Continuar editando' }).click()
  })
})
