import { randomUUID } from 'node:crypto'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import { apiAs, freeCreation, rawAs, signUp } from '../support/users'

// P04-D a 390 px: o estado da ficha sob o nome, na lista e na Mesa (R-12,
// D-02), o próximo passo e "Avisar que terminei" na criação livre (R-13,
// D-03) e "Pedir ajuste" com motivo (R-14, D-04). Confere no DOM o que o
// Jest não vê: o aria-live do selo, o selo no nome acessível da linha e o
// diálogo de 560 no desktop. Só contas fictícias, criadas aqui.

test.use({ viewport: { width: 390, height: 844 } })

type User = Awaited<ReturnType<typeof signUp>>

/** Narrador com uma crônica do V20 e duas jogadoras já dentro dela. */
async function table(
  storytellerContext: BrowserContext,
  playerContext: BrowserContext,
  otherContext: BrowserContext,
  name: string
) {
  const storyteller = await signUp(storytellerContext, 'estado_narra')
  const chronicle = await apiAs<{ id: string }>(
    storytellerContext,
    storyteller,
    'POST',
    '/chronicles',
    { name, systemCode: 'vtm-v20' }
  )
  const { code } = await apiAs<{ code: string }>(
    storytellerContext,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`,
    {}
  )
  const player = await signUp(playerContext, 'estado_joga')
  await apiAs(playerContext, player, 'POST', '/invites/accept', { code })
  const other = await signUp(otherContext, 'estado_outra')
  await apiAs(otherContext, other, 'POST', '/invites/accept', { code })
  return { storyteller, player, other, chronicleId: chronicle.id }
}

/** A conta da V20 fechada pela API (os números do lifecycle.spec.ts). */
async function fillV20(context: BrowserContext, user: User, id: string) {
  await apiAs(context, user, 'PATCH', `/characters/${id}/creation`, {
    revision: 0,
    choices: {
      priorities: {
        attributes: ['physical', 'social', 'mental'],
        abilities: ['talents', 'skills', 'knowledges'],
      },
    },
  })
  const values: Record<string, unknown> = {
    strength: 4,
    dexterity: 3,
    stamina: 3,
    charisma: 3,
    manipulation: 3,
    appearance: 2,
    perception: 2,
    intelligence: 2,
    wits: 2,
    alertness: 3,
    athletics: 3,
    awareness: 3,
    brawl: 3,
    empathy: 1,
    animalKen: 3,
    crafts: 3,
    drive: 3,
    academics: 3,
    computer: 2,
    disciplines: [
      { id: 'd1', name: 'Taumaturgia', value: 2 },
      { id: 'd2', name: 'Auspícios', value: 1 },
    ],
    backgrounds: [
      { id: 'b1', name: 'Recursos', value: 3 },
      { id: 'b2', name: 'Mentor', value: 2 },
    ],
    conscience: 4,
    selfControl: 3,
    courage: 3,
  }
  await apiAs(context, user, 'POST', `/characters/${id}/events`, {
    clientBatchId: randomUUID(),
    events: Object.entries(values).map(([path, to]) => ({
      path: `values.${path}`,
      from: null,
      to,
    })),
  })
}

const create = (
  context: BrowserContext,
  user: User,
  chronicleId: string,
  name: string
) =>
  apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicleId}/characters`,
    { values: { name, clan: 'tremere' } }
  )

const radio = (page: Page, name: string) =>
  page.getByRole('radio', { name, exact: true })

/** "dd/mm" do instante no fuso do navegador, como o app formata. */
const browserDate = (page: Page, iso: string) =>
  page.evaluate(at => {
    const d = new Date(at)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  }, iso)

test('R-12: o selo na lista, sob o nome, concluída e na Mesa', async ({
  browser,
  page,
}) => {
  const desk = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const third = await browser.newContext()
  try {
    const { storyteller, player, chronicleId } = await table(
      desk,
      page.context(),
      third,
      'Crônica dos selos'
    )
    const { id } = await create(
      page.context(),
      player,
      chronicleId,
      'Isadora Vex'
    )

    // Lista: o estado entra no nome acessível da linha
    await page.goto(`/chronicles/${chronicleId}`)
    const row = page.getByRole('button', {
      name: /^Isadora Vex, .*Sua ficha, Em criação · por pontos$/,
    })
    await expect(row).toBeVisible()
    await row.click()
    // Sob o nome, como região viva (atributo no DOM)
    const badge = page.getByTestId('sheet-state')
    await expect(badge).toHaveText('Em criação · por pontos')
    await expect(badge).toHaveAttribute('aria-live', 'polite')
    await expect(
      page.getByRole('tablist', { name: 'Partes da ficha' })
    ).toBeVisible()
    await page.getByRole('tab', { name: 'Pontos', exact: true }).click()
    await expect(page.getByTestId('sheet-state')).toBeVisible()

    // Concluída pela API: "Concluída em dd/mm" na lista e sob o nome
    await fillV20(page.context(), player, id)
    const done = await apiAs<{ status: string; creationCompletedAt: string }>(
      page.context(),
      player,
      'POST',
      `/characters/${id}/creation/complete`,
      { clientCommandId: randomUUID() }
    )
    expect(done.status).toBe('active')
    const day = await browserDate(page, done.creationCompletedAt)
    await page.goto(`/chronicles/${chronicleId}`)
    await expect(
      page.getByRole('button', {
        name: new RegExp(
          `^Isadora Vex, .*Sua ficha, Concluída em ${day.replace('/', '\\/')}$`
        ),
      })
    ).toBeVisible()

    // Mesa: com a aprovação ligada, a enviada diz "Aguardando aprovação"
    await apiAs(
      desk,
      storyteller,
      'PATCH',
      `/chronicles/${chronicleId}/creation-settings`,
      { revision: 0, approval: true }
    )
    const sent = await create(
      page.context(),
      player,
      chronicleId,
      'Helena Varga'
    )
    await fillV20(page.context(), player, sent.id)
    await apiAs(
      page.context(),
      player,
      'POST',
      `/characters/${sent.id}/creation/complete`,
      { clientCommandId: randomUUID() }
    )
    const st = await desk.newPage()
    await st.goto(`/chronicles/${chronicleId}`)
    await st.getByRole('tab', { name: 'Mesa' }).click()
    await expect(st.getByTestId(`table-row-${sent.id}`)).toContainText(
      'Aguardando aprovação'
    )
  } finally {
    await desk.close()
    await third.close()
  }
})

test('R-13 e R-14: avisar que terminei, pedir ajuste, privacidade e Histórico', async ({
  browser,
  page,
}) => {
  const desk = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const third = await browser.newContext()
  try {
    const { storyteller, player, other, chronicleId } = await table(
      desk,
      page.context(),
      third,
      'Crônica livre'
    )
    await freeCreation(desk, storyteller, chronicleId)
    const { id } = await create(
      page.context(),
      player,
      chronicleId,
      'Caio Ventura'
    )

    // R-13: a ficha livre abre no Editar com o próximo passo
    await page.goto(`/characters/${id}`)
    await expect(radio(page, 'Editar')).toBeChecked()
    await expect(page.getByTestId('next-step')).toHaveText(
      'Quando terminar, avise: o narrador conclui.'
    )
    const announce = page.getByRole('button', {
      name: 'Avisar que terminei',
      exact: true,
    })
    // Habilitado de verdade, sem `disabled` no DOM (lição do e8cfaf8)
    await expect(announce).toBeEnabled()
    await announce.click()
    await page.getByTestId('creation-ready-confirm').click()
    await expect(
      page.getByText('Pronto: o narrador foi avisado.')
    ).toBeVisible()
    await expect(page.getByTestId('sheet-state')).toHaveText(
      'Você avisou que terminou'
    )
    await expect(announce).toHaveCount(0)

    // O narrador vê o aviso na aba Fichas e na Mesa
    const st = await desk.newPage()
    await st.goto(`/chronicles/${chronicleId}`)
    await expect(st.getByTestId('ready-review')).toContainText(
      '1 jogador avisou que terminou'
    )
    await st.getByRole('tab', { name: 'Mesa' }).click()
    await expect(st.getByTestId(`table-row-${id}`)).toContainText(
      'Avisou que terminou'
    )

    // R-14: pedir ajuste pelo "Mais opções", a 390
    const reason = 'Refaça os Antecedentes'
    await st.goto(`/characters/${id}`)
    const more = st.getByRole('button', { name: 'Mais opções' })
    await more.click()
    await st.getByRole('button', { name: /^Ações do narrador/ }).click()
    await st.getByTestId('status-adjust').click()
    // Esc fecha a folha e devolve o foco ao "Mais opções"
    await st.keyboard.press('Escape')
    await expect(more).toBeFocused()
    await more.click()
    await st.getByRole('button', { name: /^Ações do narrador/ }).click()
    await st.getByTestId('status-adjust').click()
    await st.getByLabel('O que precisa ser ajustado').fill(reason)
    await st.getByTestId('status-adjust-confirm').click()
    await expect(
      st.getByText('Ajuste pedido. O jogador vê o motivo na ficha.')
    ).toBeVisible()

    // A jogadora vê o motivo em Editar e em Jogo; a lista diz o estado
    await page.reload()
    await expect(page.getByTestId('creation-adjust')).toContainText(reason)
    await radio(page, 'Jogo').click()
    await expect(page.getByTestId('creation-adjust')).toContainText(reason)
    await page.goto(`/chronicles/${chronicleId}`)
    await expect(
      page.getByRole('button', {
        name: /^Caio Ventura, .*Sua ficha, Aguardando ajuste$/,
      })
    ).toBeVisible()

    // Privacidade: o motivo não sai na lista nem na Mesa; a outra jogadora
    // não alcança a ficha
    const mine = await rawAs(
      page.context(),
      player,
      'GET',
      `/chronicles/${chronicleId}/characters`
    )
    expect(await mine.text()).not.toContain(reason)
    const tableRes = await rawAs(
      desk,
      storyteller,
      'GET',
      `/chronicles/${chronicleId}/table`
    )
    expect(await tableRes.text()).not.toContain(reason)
    const theirs = await rawAs(
      third,
      other,
      'GET',
      `/chronicles/${chronicleId}/characters`
    )
    const rows = (await theirs.json()) as { id: string }[]
    expect(rows.some(r => r.id === id)).toBe(false)
    expect(
      (await rawAs(third, other, 'GET', `/characters/${id}`)).status()
    ).toBe(404)

    // Histórico: a jogadora avisa de novo, o narrador conclui pelo menu
    await apiAs(
      page.context(),
      player,
      'POST',
      `/characters/${id}/creation/ready`,
      {
        clientCommandId: randomUUID(),
      }
    )
    await st.reload()
    await st.getByRole('button', { name: 'Mais opções' }).click()
    await st.getByRole('button', { name: /^Ações do narrador/ }).click()
    await st.getByTestId('status-complete').click()
    await st.getByTestId('status-complete-confirm').click()
    await expect(st.getByTestId('sheet-state')).toContainText('Concluída em')
    await st.getByRole('button', { name: 'Mais opções' }).click()
    await st.getByRole('button', { name: 'Histórico', exact: true }).click()
    const history = st
      .getByRole('dialog')
      .or(st.locator('[aria-modal]'))
      .first()
    await expect(history.getByText('Ajuste pedido')).toBeVisible()
    await expect(history.getByText('Avisou que terminou')).toHaveCount(2)
    // Exato: o aviso "Criação concluída. Subir um traço…" acompanha a folha
    // de cima (P12) e, com o espaço da folha sem rodapé (T-43), pode ficar
    // sob o ponteiro parado, que segura o prazo (T-76)
    await expect(
      history.getByText('Criação concluída', { exact: true })
    ).toBeVisible()
    await expect(history.getByText(reason)).toHaveCount(0)
    // O ponteiro sai de cima, e o aviso some no prazo (nada fica preso)
    await st.mouse.move(0, 0)
    await expect(history.getByText(/^Criação concluída\. Subir/)).toHaveCount(
      0,
      { timeout: 10_000 }
    )
  } finally {
    await desk.close()
    await third.close()
  }
})

test('desktop: "Pedir ajuste" pelo botão largo, no diálogo de 560', async ({
  browser,
}) => {
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const player = await browser.newContext()
  const third = await browser.newContext()
  try {
    const t = await table(desk, player, third, 'Crônica larga')
    const { id } = await create(player, t.player, t.chronicleId, 'Dora Lins')
    const st = await desk.newPage()
    await st.goto(`/characters/${id}`)
    await st.getByTestId('status-menu').click()
    await st.getByTestId('status-adjust').click()
    // O painel do diálogo, não a camada da folha (que ocupa a tela toda),
    // como no T-69 do layout.spec
    const dialog = st
      .getByTestId('bottom-sheet-root')
      .locator('[aria-modal="true"]')
    await expect(dialog.getByLabel('O que precisa ser ajustado')).toBeVisible()
    // A animação de entrada termina antes de medir
    await expect
      .poll(async () => (await dialog.boundingBox())?.y ?? -1)
      .toBeGreaterThan(0)
    const box = (await dialog.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(560)
    expect(Math.abs(box.x + box.width / 2 - 1280 / 2)).toBeLessThanOrEqual(2)
  } finally {
    await desk.close()
    await player.close()
    await third.close()
  }
})
