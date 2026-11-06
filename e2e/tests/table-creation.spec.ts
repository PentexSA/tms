import { randomUUID } from 'node:crypto'
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test'
import { ALMOST, PRIORITIES } from '../support/creation'
import { apiAs, signUp } from '../support/users'

// P09-D (D-10, R-15, T-36): o narrador acompanha a criação pela Mesa. O
// painel "Criação de fichas" recolhido com as abas no topo; o progresso de
// cada cartão em criação por pontos, nos três sistemas; o filtro "Em
// criação" / "Pendentes"; a contagem na lista de crônicas; a aba Pontos em
// `pending`. Confere no DOM o que o Jest não vê: o `aria-pressed` dos chips,
// o `aria-live` da linha do filtro, o nome acessível do cartão, o foco e as
// medidas reais. Só contas fictícias, criadas aqui.

test.use({ viewport: { width: 390, height: 844 } })

type User = Awaited<ReturnType<typeof signUp>>

interface Desk {
  readonly storyteller: User
  readonly player: User
  readonly chronicleId: string
}

/** Narrador com uma crônica e uma jogadora dentro dela. */
async function desk(
  storytellerContext: BrowserContext,
  playerContext: BrowserContext,
  systemCode = 'vtm-v20',
  name = 'Crônica da Mesa'
): Promise<Desk> {
  const storyteller = await signUp(storytellerContext, 'mesa_narra')
  const chronicle = await apiAs<{ id: string }>(
    storytellerContext,
    storyteller,
    'POST',
    '/chronicles',
    { name, systemCode }
  )
  const { code } = await apiAs<{ code: string }>(
    storytellerContext,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`,
    {}
  )
  const player = await signUp(playerContext, 'mesa_joga')
  await apiAs(playerContext, player, 'POST', '/invites/accept', { code })
  return { storyteller, player, chronicleId: chronicle.id }
}

/** As regras da crônica salvas pela API: o painel abre recolhido. */
const saveRules = (
  context: BrowserContext,
  d: Desk,
  body: Record<string, unknown> = {}
) =>
  apiAs(
    context,
    d.storyteller,
    'PATCH',
    `/chronicles/${d.chronicleId}/creation-settings`,
    { revision: 0, approval: false, ...body }
  )

const create = (
  context: BrowserContext,
  d: Desk,
  values: Record<string, unknown>
) =>
  apiAs<{ id: string }>(
    context,
    d.player,
    'POST',
    `/chronicles/${d.chronicleId}/characters`,
    { values }
  )

/** Prioridades e pontos pela API, como o app gravaria. */
async function fill(
  context: BrowserContext,
  user: User,
  id: string,
  values: Record<string, unknown>
) {
  await apiAs(context, user, 'PATCH', `/characters/${id}/creation`, {
    revision: 0,
    choices: { priorities: PRIORITIES },
  })
  await apiAs(context, user, 'POST', `/characters/${id}/events`, {
    clientBatchId: randomUUID(),
    events: Object.entries(values).map(([k, to]) => ({
      path: `values.${k}`,
      from: null,
      to,
    })),
  })
}

const tabsTop = async (page: Page) =>
  (await page.getByRole('tablist', { name: 'Visão da crônica' }).boundingBox())
    ?.y ?? 9999

const openTable = async (page: Page, chronicleId: string) => {
  await page.goto(`/chronicles/${chronicleId}`)
  await page.getByRole('tab', { name: 'Mesa' }).click()
  await expect(page).toHaveURL(/\?view=table$/)
}

async function contexts(browser: Browser) {
  const st = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pl = await browser.newContext({ viewport: { width: 390, height: 844 } })
  return { st, pl, close: () => Promise.all([st.close(), pl.close()]) }
}

test('T-36: o painel recolhido, com o resumo que o jogador lê, e as abas no topo', async ({
  browser,
}) => {
  const c = await contexts(browser)
  try {
    const d = await desk(c.st, c.pl)
    await saveRules(c.st, d)
    // A jogadora lê a mesma linha sob "Suas fichas"
    const pp = await c.pl.newPage()
    await pp.goto(`/chronicles/${d.chronicleId}`)
    const line = (await pp.getByTestId('creation-summary').textContent()) ?? ''
    expect(line).toMatch(/^Criação por pontos · /)

    const page = await c.st.newPage()
    await page.goto(`/chronicles/${d.chronicleId}`)
    const summary = page.getByTestId('creation-settings-summary')
    await expect(summary).toHaveText(line)
    await expect(page.getByTestId('creation-settings-budgets')).toHaveCount(0)
    const top390 = await tabsTop(page)
    expect(top390).toBeLessThan(340)
    await page.setViewportSize({ width: 1280, height: 800 })
    const top1280 = await tabsTop(page)
    expect(top1280).toBeLessThan(260)
    // A 1280, o resumo numa linha
    expect((await summary.boundingBox())?.height ?? 99).toBeLessThanOrEqual(24)
    test.info().annotations.push({
      type: 'abas',
      description: `topo do tablist: 390 → ${top390}; 1280 → ${top1280}`,
    })
  } finally {
    await c.close()
  }
})

test('T-36: Editar, Cancelar e Salvar, com o foco', async ({ browser }) => {
  const c = await contexts(browser)
  try {
    const d = await desk(c.st, c.pl)
    await saveRules(c.st, d)
    const page = await c.st.newPage()
    await page.goto(`/chronicles/${d.chronicleId}`)
    const edit = page.getByRole('button', { name: 'Editar regras da criação' })
    await edit.click()
    await expect(page.getByTestId('creation-settings-budgets')).toBeVisible()
    // O foco no primeiro rádio da aprovação
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.getAttribute('role'))
      )
      .toBe('radio')
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(page.getByTestId('creation-settings-summary')).toBeVisible()
    await expect(edit).toBeFocused()
    // Mudar o bônus e salvar: recolhe, avisa e o resumo diz o novo
    await edit.click()
    await page
      .getByRole('button', { name: 'Aumentar Pontos de bônus', exact: true })
      .click()
    await page.getByRole('button', { name: 'Salvar regras da criação' }).click()
    await expect(page.getByText('Regras da criação salvas.')).toBeVisible()
    await expect(page.getByTestId('creation-settings-summary')).toContainText(
      '16 de bônus'
    )
  } finally {
    await c.close()
  }
})

test('T-36: a crônica nova abre o painel, e salvar o padrão sem mudança recolhe', async ({
  browser,
}) => {
  const c = await contexts(browser)
  try {
    const d = await desk(c.st, c.pl)
    const page = await c.st.newPage()
    await page.goto(`/chronicles/${d.chronicleId}`)
    const save = page.getByRole('button', { name: 'Salvar regras da criação' })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(page.getByTestId('creation-settings-summary')).toBeVisible()
  } finally {
    await c.close()
  }
})

test('R-15: o progresso no cartão do V20, o filtro e a altura, a 390 e 360', async ({
  browser,
}) => {
  const c = await contexts(browser)
  try {
    const d = await desk(c.st, c.pl)
    await saveRules(c.st, d, { approval: true })
    const fresh = await create(c.pl, d, { name: 'Recém', clan: 'tremere' })
    const almost = await create(c.pl, d, { name: 'Quase', clan: 'tremere' })
    await fill(c.pl, d.player, almost.id, ALMOST)
    const asked = await create(c.pl, d, { name: 'Ajuste', clan: 'tremere' })
    await apiAs(
      c.st,
      d.storyteller,
      'POST',
      `/characters/${asked.id}/creation/adjust`,
      {
        reason: 'Refaça as prioridades',
        clientCommandId: randomUUID(),
      }
    )
    const sent = await create(c.pl, d, { name: 'Enviada', clan: 'tremere' })
    await fill(c.pl, d.player, sent.id, { ...ALMOST, stamina: 3 })
    await apiAs(
      c.pl,
      d.player,
      'POST',
      `/characters/${sent.id}/creation/complete`,
      {
        clientCommandId: randomUUID(),
      }
    )
    const npc = await apiAs<{ id: string }>(
      c.st,
      d.storyteller,
      'POST',
      `/chronicles/${d.chronicleId}/characters`,
      {
        kind: 'npc',
        clientCommandId: randomUUID(),
        values: { name: 'Sentinela', clan: 'tremere' },
      }
    )

    const page = await c.st.newPage()
    await openTable(page, d.chronicleId)
    const progress = (id: string) => page.getByTestId(`table-progress-${id}`)
    await expect(progress(fresh.id)).toContainText('Atributos (prioridade)')
    await expect(progress(fresh.id)).toContainText(/Bônus: restam 15 de 15$/)
    await expect(progress(almost.id)).toContainText(/Bônus: restam 15 de 15$/)
    await expect(progress(asked.id)).toBeVisible()
    await expect(page.getByTestId(`table-row-${asked.id}`)).toContainText(
      'Aguardando ajuste'
    )
    await expect(page.getByTestId(`table-row-${sent.id}`)).toContainText(
      'Aguardando aprovação'
    )
    await expect(progress(sent.id)).toContainText(/^A conta fechou/)
    await expect(
      page.locator(`[data-testid="table-progress-${npc.id}"]`)
    ).toHaveCount(0)
    // O nome acessível do cartão leva o progresso inteiro, com palavras
    await expect(
      page.getByTestId(`table-row-${fresh.id}`)
    ).toHaveAccessibleName(
      /Atributos: falta escolher a prioridade, .*Bônus: restam 15 de 15/
    )

    // A altura com todos os selos, a 390 e a 360
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 })
      for (const id of [fresh.id, asked.id]) {
        const card = page.getByTestId(`table-row-${id}`)
        await card.scrollIntoViewIfNeeded()
        const box = await card.boundingBox()
        expect(box?.height ?? 999).toBeLessThan(210)
        expect((box?.x ?? 0) + (box?.width ?? 999)).toBeLessThanOrEqual(width)
        const line = await progress(id).boundingBox()
        expect((line?.x ?? 0) + (line?.width ?? 999)).toBeLessThanOrEqual(
          (box?.x ?? 0) + (box?.width ?? 0)
        )
        test.info().annotations.push({
          type: 'altura',
          description: `${width}: ${id === fresh.id ? 'recém-criada' : 'em ajuste'} ${box?.height}`,
        })
      }
    }
    await page.setViewportSize({ width: 390, height: 844 })

    // O filtro: aria-pressed, a linha viva e os NPCs fora
    const creating = page.getByRole('button', {
      name: 'Em criação (3)',
      exact: true,
    })
    await expect(creating).toHaveAttribute('aria-pressed', 'false')
    await creating.click()
    await expect(creating).toHaveAttribute('aria-pressed', 'true')
    const status = page.getByTestId('table-filter-status')
    await expect(status).toHaveText('Mostrando 3 de 4: em criação.')
    await expect(status).toHaveAttribute('aria-live', 'polite')
    await expect(page.getByTestId(`table-row-${sent.id}`)).toHaveCount(0)
    await expect(page.getByTestId('table-npcs')).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Pendentes (1)', exact: true })
      .click()
    await expect(status).toHaveText('Mostrando 1 de 4: pendentes.')
    await expect(page.getByTestId(`table-row-${sent.id}`)).toBeVisible()

    // A lista de crônicas: as duas contagens para o narrador
    await page.goto('/')
    await expect(
      page.getByRole('button', {
        // O NPC conta nos personagens, nunca nas fichas em criação
        name: /Você narra · 5 personagens · 3 fichas em criação · 1 ficha aguarda revisão/,
      })
    ).toBeVisible()
    const pp = await c.pl.newPage()
    await pp.goto('/')
    await expect(pp.getByText(/fichas em criação|aguarda revisão/)).toHaveCount(
      0
    )

    // A ficha enviada em Leitura: "Ver Pontos" leva à aba, sem gravar nada
    const writes: string[] = []
    page.on('request', r => {
      if (r.method() === 'POST' && /\/characters\/[^/]+\/events$/.test(r.url()))
        writes.push(r.url())
    })
    await page.goto(`/characters/${sent.id}`)
    await page.getByTestId('creation-pending-points').click()
    await expect(
      page.getByRole('tab', { name: 'Pontos', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('creation-freebies')).toBeVisible()
    await expect(page.getByText('Regras da casa')).toHaveCount(0)
    await expect(page.getByTestId('creation-phase-switch')).toHaveCount(0)
    expect(writes).toEqual([])
  } finally {
    await c.close()
  }
})

for (const [systemCode, expected] of [
  ['mta-m20', /Esferas: faltam \d+/],
  ['wta-w20', /Dons: faltam \d+/],
] as const)
  test(`R-15: o progresso de uma ficha nova no ${systemCode}`, async ({
    browser,
  }) => {
    const c = await contexts(browser)
    try {
      const d = await desk(c.st, c.pl, systemCode, `Crônica ${systemCode}`)
      const { id } = await create(c.pl, d, { name: 'Nova' })
      const page = await c.st.newPage()
      await openTable(page, d.chronicleId)
      const line = page.getByTestId(`table-progress-${id}`)
      // A 390, o "e mais N" pode esconder o orçamento: o nome acessível tem
      // tudo
      await expect(line).toContainText('Atributos (prioridade)')
      await expect(page.getByTestId(`table-row-${id}`)).toHaveAccessibleName(
        expected
      )
    } finally {
      await c.close()
    }
  })

test('R-15: a grade de 1280 com o progresso em cada célula', async ({
  browser,
}) => {
  const c = await contexts(browser)
  try {
    const d = await desk(c.st, c.pl)
    const ids: string[] = []
    for (const name of ['Uma', 'Duas', 'Três'])
      ids.push((await create(c.pl, d, { name, clan: 'tremere' })).id)
    const page = await c.st.newPage()
    await page.setViewportSize({ width: 1280, height: 800 })
    await openTable(page, d.chronicleId)
    for (const id of ids) {
      const cell = page.getByTestId(`table-cell-${id}`)
      await expect(cell.getByTestId(`table-progress-${id}`)).toBeVisible()
      const cellBox = await cell.boundingBox()
      const line = await page.getByTestId(`table-progress-${id}`).boundingBox()
      expect((line?.x ?? 0) + (line?.width ?? 999)).toBeLessThanOrEqual(
        (cellBox?.x ?? 0) + (cellBox?.width ?? 0)
      )
    }
  } finally {
    await c.close()
  }
})

test('R-15: dez fichas em criação, todas com o progresso', async ({
  browser,
}) => {
  const c = await contexts(browser)
  try {
    const d = await desk(c.st, c.pl)
    const ids: string[] = []
    for (let i = 1; i <= 10; i++)
      ids.push(
        (await create(c.pl, d, { name: `Ficha ${i}`, clan: 'tremere' })).id
      )
    const page = await c.st.newPage()
    const started = Date.now()
    await openTable(page, d.chronicleId)
    const last = page.getByTestId(`table-progress-${ids[9]}`)
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeVisible()
    test.info().annotations.push({
      type: 'tempo',
      description: `da Mesa ao décimo cartão: ${Date.now() - started} ms (indicativo)`,
    })
    for (const id of ids)
      await expect(page.getByTestId(`table-progress-${id}`)).toHaveCount(1)
  } finally {
    await c.close()
  }
})
