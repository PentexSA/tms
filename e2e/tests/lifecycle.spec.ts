import { randomUUID } from 'node:crypto'
import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import { apiAs, freeCreation, signUp } from '../support/users'

// P04-C, o ciclo de vida da ficha a 390 px: a ficha em criação abre na
// montagem por qualquer entrada (T-05), a devolução aparece em qualquer modo
// e na lista (T-06), concluir e aprovar confirmam com o texto de quem lê
// (T-32), e o Histórico mostra "Criação concluída" sem as linhas do freeze
// (T-80). Só contas fictícias, criadas aqui.

test.use({ viewport: { width: 390, height: 844 } })

type User = Awaited<ReturnType<typeof signUp>>

/** Narrador com uma crônica do V20 e uma jogadora já dentro dela. */
async function table(
  storytellerContext: BrowserContext,
  playerContext: BrowserContext,
  name: string
) {
  const storyteller = await signUp(storytellerContext, 'ciclo_narra')
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
  const player = await signUp(playerContext, 'ciclo_joga')
  await apiAs(playerContext, player, 'POST', '/invites/accept', { code })
  return { storyteller, player, chronicleId: chronicle.id }
}

/**
 * A conta da V20 fechada pela API, com as prioridades escolhidas: os mesmos
 * números do teste de Criação do app (CreationScreen.test.tsx).
 */
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

const radio = (page: Page, name: string) =>
  page.getByRole('radio', { name, exact: true })

test('T-05: a ficha em criação abre na montagem pela lista e depois de recarregar', async ({
  browser,
  page,
}) => {
  const desk = await browser.newContext()
  try {
    const { storyteller, player, chronicleId } = await table(
      desk,
      page.context(),
      'Crônica por pontos'
    )

    // Por pontos: criada pela tela, a ficha abre em Criação
    await page.goto(`/chronicles/${chronicleId}`)
    await page.getByRole('button', { name: 'Nova ficha' }).click()
    await expect(page.getByTestId('new-character-intro')).toContainText(
      'Esta crônica usa criação por pontos: Atributos 7/5/3'
    )
    await page.getByLabel('Nome (obrigatório)').fill('Isadora Vex')
    await page.getByRole('radio', { name: 'Tremere' }).click()
    await page.getByRole('button', { name: 'Criar ficha' }).click()
    await expect(radio(page, 'Criação')).toBeChecked()

    // Voltar à crônica e tocar a ficha na lista: Criação, com o Orçamento
    // (QAW-37, IW-04)
    await page
      .getByRole('button', { name: 'Voltar para Crônica por pontos' })
      .click()
    await page.getByRole('button', { name: /^Isadora Vex,/ }).click()
    await expect(radio(page, 'Criação')).toBeChecked()
    await expect(page.getByRole('tab', { name: 'Orçamento' })).toBeVisible()
    // Recarregar: Criação de novo (EW-08)
    await page.reload()
    await expect(radio(page, 'Criação')).toBeChecked()

    // Livre: a ficha abre em Editar, sem conta
    await freeCreation(desk, storyteller, chronicleId)
    const free = await apiAs<{ id: string }>(
      page.context(),
      player,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      { values: { name: 'Caio Ventura', clan: 'tremere' } }
    )
    await page.goto(`/chronicles/${chronicleId}`)
    await page.getByRole('button', { name: /^Caio Ventura,/ }).click()
    await expect(page).toHaveURL(new RegExp(`/characters/${free.id}$`))
    await expect(radio(page, 'Editar')).toBeChecked()
    await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
  } finally {
    await desk.close()
  }
})

test('T-06, T-32 e T-80: devolver, ver o motivo em qualquer modo, aprovar e o Histórico', async ({
  browser,
  page,
}) => {
  const desk = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  try {
    const { storyteller, player, chronicleId } = await table(
      desk,
      page.context(),
      'Crônica com aprovação'
    )
    await apiAs(
      desk,
      storyteller,
      'PATCH',
      `/chronicles/${chronicleId}/creation-settings`,
      { revision: 0, approval: true }
    )
    const { id } = await apiAs<{ id: string }>(
      page.context(),
      player,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      { values: { name: 'Helena Varga', clan: 'tremere' } }
    )
    await fillV20(page.context(), player, id)
    const submit = () =>
      apiAs<{ status: string }>(
        page.context(),
        player,
        'POST',
        `/characters/${id}/creation/complete`,
        { clientCommandId: randomUUID() }
      )
    expect((await submit()).status).toBe('pending')

    // A jogadora fica com a ficha aberta, aguardando
    await page.goto(`/characters/${id}`)
    await expect(page.getByText('Aguardando aprovação')).toBeVisible()

    // O narrador devolve com o motivo, pela tela
    const st = await desk.newPage()
    const reason = 'Troque 1 ponto de Ofícios por Esquiva'
    await st.goto(`/characters/${id}`)
    await st.getByTestId('creation-return-open').click()
    await st.getByTestId('creation-return-reason').fill(reason)
    await st.getByTestId('creation-return').click()
    await expect(st.getByText('Ficha devolvida para correção.')).toBeVisible()

    // A ficha aberta da jogadora: o foco da janela rebusca (POW-09). Volta à
    // Criação, com o motivo; em Jogo, o motivo continua
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    const returned = page.getByTestId('creation-returned')
    await expect(returned).toContainText('O narrador devolveu a ficha')
    await expect(returned).toContainText(reason)
    await expect(radio(page, 'Criação')).toBeChecked()
    await radio(page, 'Jogo').click()
    await expect(radio(page, 'Jogo')).toBeChecked()
    await expect(returned).toContainText(reason)
    // O narrador lê o texto dele
    await st.reload()
    await expect(st.getByTestId('creation-returned')).toContainText(
      'Você devolveu esta ficha'
    )

    // Na crônica, a linha diz "Devolvida", sem o motivo (POA-35, QAA-13)
    await page
      .getByRole('button', { name: 'Voltar para Crônica com aprovação' })
      .click()
    await expect(
      page.getByRole('button', { name: /Sua ficha · Devolvida$/ })
    ).toBeVisible()
    await expect(page.getByText(reason)).toHaveCount(0)

    // A jogadora envia de novo; o narrador aprova, depois de confirmar
    expect((await submit()).status).toBe('pending')
    let approvals = 0
    st.on('request', r => {
      if (r.method() === 'POST' && r.url().endsWith(`/${id}/creation/approve`))
        approvals++
    })
    await st.reload()
    await st.getByTestId('creation-approve').click()
    await expect(st.getByText('Aprovar ficha?')).toBeVisible()
    await expect(st.getByTestId('completion-message').last()).toContainText(
      'passa por você'
    )
    expect(approvals).toBe(0)
    await st.getByTestId('creation-approve-confirm').click()
    await expect(st.getByText('Ficha aprovada e liberada.')).toBeVisible()
    expect(approvals).toBe(1)

    // O Histórico da jogadora: "Criação concluída" do narrador, sem as linhas
    // do freeze ("Humanidade 0 → 7", POW-34)
    await page.goto(`/characters/${id}`)
    // A 390, o Histórico fica no "Mais opções" (T-11)
    await page.getByRole('button', { name: 'Mais opções' }).click()
    await page.getByRole('button', { name: 'Histórico', exact: true }).click()
    await expect(page.getByText('Criação concluída')).toBeVisible()
    await expect(
      page.getByLabel(
        new RegExp(
          `^Criação concluída\\. .* · ${storyteller.username} \\(narrador\\)$`
        )
      )
    ).toBeVisible()
    await expect(page.getByText(/^Humanidade: /)).toHaveCount(0)
    await expect(page.getByText(/^Força de Vontade: /)).toHaveCount(0)
  } finally {
    await desk.close()
  }
})

test('T-32: o narrador conclui pelo ⋯ só depois de confirmar', async ({
  browser,
  page,
}) => {
  const playerContext = await browser.newContext()
  try {
    const { storyteller, player, chronicleId } = await table(
      page.context(),
      playerContext,
      'Crônica livre'
    )
    await freeCreation(page.context(), storyteller, chronicleId)
    const { id } = await apiAs<{ id: string }>(
      playerContext,
      player,
      'POST',
      `/chronicles/${chronicleId}/characters`,
      { values: { name: 'Otto Brandt', clan: 'tremere' } }
    )
    let completions = 0
    page.on('request', r => {
      if (r.method() === 'POST' && r.url().endsWith(`/${id}/creation/complete`))
        completions++
    })
    await page.goto(`/characters/${id}`)
    // A 390, as ações do narrador ficam no "Mais opções", com o estado (T-11)
    await page.getByRole('button', { name: 'Mais opções' }).click()
    await page
      .getByRole('button', { name: 'Ações do narrador · Em criação' })
      .click()
    await page
      .getByRole('button', { name: 'Concluir criação', exact: true })
      .click()
    // A pergunta vem antes; nada vai ao servidor (QAW-36, NW-26)
    await expect(page.getByText('Concluir criação?')).toBeVisible()
    await expect(page.getByTestId('completion-message')).toContainText(
      'passa por você'
    )
    expect(completions).toBe(0)
    await page.getByRole('button', { name: 'Voltar', exact: true }).click()
    await page
      .getByRole('button', { name: 'Concluir criação', exact: true })
      .click()
    await page.getByTestId('status-complete-confirm').click()
    await expect(
      page.getByText('Criação concluída. Subir um traço agora passa por você.')
    ).toBeVisible()
    expect(completions).toBe(1)
  } finally {
    await playerContext.close()
  }
})
