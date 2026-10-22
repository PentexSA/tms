import { expect, type Page, test } from '@playwright/test'
import { API_URL } from '../env'
import { apiAs, signUp } from '../support/users'

test.use({ actionTimeout: 15_000 })

// v3, doc/plano-v3.md §1: três pessoas, cada uma com a própria sessão.
// Duas páginas da jogadora A provam a recusa de uma ficha já aberta, sem
// recarregar e sem depender de tempo real.
const close = (page: Page) =>
  page.getByRole('button', { name: 'Fechar' }).last().click()
const response = (page: Page, path: string, status: number) =>
  page.waitForResponse(
    r =>
      r.url().endsWith(path) &&
      r.request().method() === 'POST' &&
      r.status() === status
  )

async function createSheet(page: Page, chronicleId: string, name: string) {
  await page.goto(`/chronicles/${chronicleId}`)
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  await page.getByLabel('Nome (obrigatório)').fill(name)
  await page.getByRole('radio', { name: 'Tremere' }).click()
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}$/)
  const id = /characters\/([0-9a-f-]{36})/.exec(page.url())![1]!
  await page
    .getByRole('button', { name: 'Aumentar Força', exact: true })
    .click()
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole('button', {
        name: 'Aumentar Força de Vontade permanente',
        exact: true,
      })
      .click()
    await page
      .getByRole('button', {
        name: 'Aumentar Força de Vontade atual',
        exact: true,
      })
      .click()
  }
  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  const saved = response(page, `/characters/${id}/events`, 200)
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await saved
  await page.getByRole('radio', { name: 'Jogo', exact: true }).click()
  return id
}

async function dice(page: Page, cost: boolean) {
  await page.getByRole('button', { name: 'Dados', exact: true }).click()
  await page.getByRole('button', { name: /^Atributo:/ }).click()
  await page.getByLabel('Buscar atributo').fill('força')
  await page.getByRole('button', { name: 'Força, 2', exact: true }).click()
  await page.getByRole('button', { name: /^Habilidade ou Disciplina:/ }).click()
  await page.getByLabel('Buscar habilidade ou disciplina').fill('esportes')
  await page.getByRole('button', { name: 'Esportes, 0', exact: true }).click()
  if (cost)
    await page
      .getByRole('checkbox', {
        name: 'Gastar 1 Força de Vontade: +1 sucesso automático',
      })
      .click()
}

test('a jornada da v3: concluir, dano em grupo, desfazer, travar e remover', async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000)
  const desk = page.context()
  const storyteller = await signUp(desk, 'mesa')
  const contextA = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const contextB = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  try {
    const playerA = await signUp(contextA, 'jogaa')
    const playerB = await signUp(contextB, 'jogab')
    const a = await contextA.newPage()
    const b = await contextB.newPage()

    await page.goto('/')
    await page.getByRole('button', { name: 'Criar crônica' }).click()
    await page.getByLabel('Nome da crônica').fill('Mesa administrável')
    await page.getByRole('radio', { name: /Vampiro: A Máscara/ }).click()
    await page.getByRole('button', { name: 'Criar crônica' }).click()
    await expect(
      page.getByRole('heading', { name: 'Mesa administrável' })
    ).toBeVisible()
    const chronicleId = /chronicles\/([0-9a-f-]{36})/.exec(page.url())![1]!
    await page.getByRole('button', { name: 'Convidar' }).click()
    await page.getByRole('button', { name: 'Gerar convite' }).click()
    const code = (
      await page.getByTestId('invite-code-value').innerText()
    ).trim()
    await close(page)
    for (const [ctx, user] of [
      [contextA, playerA],
      [contextB, playerB],
    ] as const)
      await apiAs(ctx, user, 'POST', '/invites/accept', { code })
    const idA = await createSheet(a, chronicleId, 'Helena Varga')
    const idB = await createSheet(b, chronicleId, 'Caio Ventura')

    const privateSheets = async () => {
      const forbidden = await contextB.request.get(
        `${API_URL}/characters/${idA}`,
        { headers: { authorization: `Bearer ${playerB.accessToken}` } }
      )
      expect(forbidden.status()).toBe(404)
      expect(await forbidden.text()).not.toContain('Helena')
      const own = await apiAs<{ id: string }[]>(
        contextB,
        playerB,
        'GET',
        `/chronicles/${chronicleId}/characters`
      )
      expect(own.map(c => c.id)).toEqual([idB])
    }
    await privateSheets()

    // 2. A conclusão fecha a evolução, mas mantém o gasto de FdV temporária.
    await page.goto(`/characters/${idA}`)
    await page
      .getByRole('button', { name: 'Ações do narrador', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Concluir criação', exact: true })
      .click()
    await expect(
      page.getByText('Criação concluída. Subir um traço agora passa por você.')
    ).toBeVisible()
    await a.reload()
    const spent = response(a, `/characters/${idA}/events`, 200)
    await a.getByTestId('dock-willpower').click({ delay: 800 })
    await spent
    await a.getByRole('radio', { name: 'Editar', exact: true }).click()
    await expect(
      a.getByRole('button', { name: 'Aumentar Força', exact: true })
    ).toBeDisabled()
    await a.getByRole('radio', { name: 'Jogo', exact: true }).click()
    await privateSheets()

    // 3. Dois personagens, uma operação e a mesma reversão pelo snackbar.
    await page.goto(`/chronicles/${chronicleId}`)
    await page.getByRole('tab', { name: 'Mesa' }).click()
    await page.getByRole('button', { name: 'Selecionar personagens' }).click()
    await page
      .getByRole('checkbox', { name: 'Selecionar Helena Varga' })
      .click()
    await page
      .getByRole('checkbox', { name: 'Selecionar Caio Ventura' })
      .click()
    await page
      .getByRole('button', { name: 'Aplicar dano', exact: true })
      .click()
    await page.getByRole('button', { name: 'Letal', exact: true }).click()
    await page
      .getByRole('button', { name: 'Aumentar Quantidade', exact: true })
      .click()
    await page.getByRole('button', { name: 'Ver prévia' }).click()
    await expect(page.getByTestId(`operation-preview-${idA}`)).toContainText(
      'Vitalidade'
    )
    await expect(page.getByTestId(`operation-preview-${idB}`)).toContainText(
      'Vitalidade'
    )
    await page.getByRole('button', { name: 'Confirmar operação' }).click()
    await expect(
      page.getByText('Dano aplicado em 2 personagens.')
    ).toBeVisible()
    for (const id of [idA, idB]) {
      const c = await apiAs<{
        sheet: { values: { health: { lethal: number } } }
      }>(desk, storyteller, 'GET', `/characters/${id}`)
      expect(c.sheet.values.health.lethal).toBe(2)
    }
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click()
    await expect(page.getByText('Alteração desfeita.')).toBeVisible()
    for (const id of [idA, idB]) {
      const c = await apiAs<{
        sheet: { values: { health?: { lethal: number } } }
      }>(desk, storyteller, 'GET', `/characters/${id}`)
      expect(c.sheet.values.health?.lethal ?? 0).toBe(0)
    }
    await privateSheets()

    // 4. Uma ficha já aberta recebe o motivo da trava, inclusive em /rolls.
    await a.goto(`/characters/${idA}`)
    const rollPage = await contextA.newPage()
    await rollPage.goto(`/characters/${idA}`)
    await dice(rollPage, true)
    await page.goto(`/characters/${idA}`)
    await page
      .getByRole('button', { name: 'Ações do narrador', exact: true })
      .click()
    await page.getByRole('button', { name: 'Travar', exact: true }).click()
    await expect(page.getByText('Ficha travada.')).toBeVisible()
    const lockedRoll = response(rollPage, `/characters/${idA}/rolls`, 403)
    await rollPage.getByRole('button', { name: 'Rolar no app' }).click()
    expect(await (await lockedRoll).json()).toMatchObject({
      code: 'SHEET_LOCKED',
    })
    await expect(
      rollPage.getByText('O narrador travou a ficha. A rolagem não foi feita.')
    ).toBeVisible()
    const lockedSpend = response(a, `/characters/${idA}/events`, 403)
    await a.getByTestId('dock-willpower').click({ delay: 800 })
    expect(await (await lockedSpend).json()).toMatchObject({
      code: 'SHEET_LOCKED',
    })
    await expect(
      a.getByText('O narrador travou a ficha. A alteração foi desfeita.')
    ).toBeVisible()
    await a.reload()
    await dice(a, false)
    const freeRoll = response(a, `/characters/${idA}/rolls`, 201)
    await a.getByRole('button', { name: 'Rolar no app' }).click()
    await freeRoll
    await close(a)
    await privateSheets()

    // 5. Retoma, abre as duas páginas e remove a jogadora sem recarregá-las.
    await page
      .getByRole('button', { name: 'Ações do narrador', exact: true })
      .click()
    await page.getByRole('button', { name: 'Destravar', exact: true }).click()
    await expect(page.getByText('Ficha destravada.')).toBeVisible()
    await a.reload()
    await rollPage.reload()
    await dice(rollPage, true)
    await page.goto(`/chronicles/${chronicleId}`)
    const detail = await apiAs<{ members: { id: string; username: string }[] }>(
      desk,
      storyteller,
      'GET',
      `/chronicles/${chronicleId}`
    )
    const memberId = detail.members.find(
      m => m.username === playerA.username
    )!.id
    await page.getByTestId(`remove-${memberId}`).click()
    await page
      .getByRole('button', { name: 'Remover', exact: true })
      .last()
      .click()
    await expect(
      page.getByText(`${playerA.username} saiu da crônica.`)
    ).toBeVisible()
    const formerRoll = response(rollPage, `/characters/${idA}/rolls`, 403)
    await rollPage.getByRole('button', { name: 'Rolar no app' }).click()
    expect(await (await formerRoll).json()).toMatchObject({
      code: 'NOT_MEMBER',
    })
    await expect(
      rollPage.getByText(
        'Você saiu desta crônica: a ficha é só leitura. A rolagem não foi feita.'
      )
    ).toBeVisible()
    const formerSpend = response(a, `/characters/${idA}/events`, 403)
    await a.getByTestId('dock-willpower').click({ delay: 800 })
    expect(await (await formerSpend).json()).toMatchObject({
      code: 'NOT_MEMBER',
    })
    await expect(
      a.getByText(
        'Você saiu desta crônica: a ficha é só leitura. A alteração foi desfeita.'
      )
    ).toBeVisible()
    await a
      .getByRole('button', { name: 'Voltar para Mesa administrável' })
      .click()
    await a.getByRole('button', { name: 'Voltar para Crônicas' }).click()
    await expect(
      a.getByRole('button', { name: /Mesa administrável.*Você saiu/ })
    ).toBeVisible()
    await a
      .getByRole('button', { name: /Mesa administrável.*Você saiu/ })
      .click()
    await expect(a.getByTestId('former-banner')).toBeVisible()
    await a.getByRole('button', { name: /^Helena Varga,/ }).click()
    await expect(a.getByTestId('policy-banner')).toContainText(
      'A ficha é só leitura.'
    )
    await expect(
      a.getByRole('radio', { name: 'Editar', exact: true })
    ).toHaveCount(0)
    await privateSheets()
  } finally {
    await contextA.close().catch(() => undefined)
    await contextB.close().catch(() => undefined)
  }
})
