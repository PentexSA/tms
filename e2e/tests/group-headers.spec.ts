import { randomUUID } from 'node:crypto'
import {
  type Browser,
  type BrowserContext,
  expect,
  type Page,
  test,
} from '@playwright/test'
import { PRIORITIES, tab } from '../support/creation'
import { apiAs, signUp } from '../support/users'

// P17, N-06: o título do grupo ("Talentos") era espremido pelo contador da
// conta até virar uma letra por linha. Na criação de Lobisomem, nos três
// estados do contador (sem prioridade; prioridades escolhidas; básicos
// fechados e 1 ponto de bônus gasto), o título de cada grupo de Atributos e
// de Habilidades fica inteiro numa linha, e o contador, os chips e o "?"
// ficam dentro da coluna do grupo. Sem rolagem lateral na página.

const GROUPS = [
  ['physical', 'Físicos'],
  ['social', 'Sociais'],
  ['mental', 'Mentais'],
  ['talents', 'Talentos'],
  ['skills', 'Perícias'],
  ['knowledges', 'Conhecimentos'],
] as const

// Todos os pontos básicos do W20 (7/5/3, 13/9/5, 5 de Antecedentes, 3 Dons)
const BASICS: Record<string, unknown> = {
  strength: 4,
  dexterity: 3,
  stamina: 3,
  charisma: 3,
  manipulation: 2,
  appearance: 3,
  perception: 2,
  intelligence: 2,
  wits: 2,
  alertness: 3,
  athletics: 3,
  brawl: 3,
  empathy: 3,
  expression: 1,
  animalKen: 3,
  crafts: 3,
  drive: 3,
  academics: 3,
  computer: 2,
  backgrounds: [
    { id: 'b1', name: 'Recursos', value: 3 },
    { id: 'b2', name: 'Mentor', value: 2 },
  ],
  gifts: [
    { id: 'g1', name: 'Persuasão', meta: { rank: 1 } },
    { id: 'g2', name: 'Cheiro do Homem', meta: { rank: 1 } },
    { id: 'g3', name: 'Dom da Fala', meta: { rank: 1 } },
  ],
}

type State = 'none' | 'priorities' | 'bonus'

async function werewolf(
  browser: Browser,
  player: BrowserContext,
  state: State
) {
  const desk = await browser.newContext()
  const storyteller = await signUp(desk, 'narra_cab')
  const chronicle = await apiAs<{ id: string }>(
    desk,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica dos cabeçalhos', systemCode: 'wta-w20' }
  )
  const { code } = await apiAs<{ code: string }>(
    desk,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`
  )
  await desk.close()
  const user = await signUp(player, 'joga_cab')
  await apiAs(player, user, 'POST', '/invites/accept', { code })
  const character = await apiAs<{ id: string }>(
    player,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    {
      values: {
        name: 'Uiva Longe',
        breed: 'hominideo',
        auspice: 'galliard',
        tribe: 'fianna',
      },
    }
  )
  if (state !== 'none')
    await apiAs(player, user, 'PATCH', `/characters/${character.id}/creation`, {
      revision: 0,
      choices: { priorities: PRIORITIES },
    })
  if (state === 'bonus')
    await apiAs(player, user, 'POST', `/characters/${character.id}/events`, {
      clientBatchId: randomUUID(),
      events: Object.entries(BASICS).map(([k, to]) => ({
        path: `values.${k}`,
        from: null,
        to,
      })),
    })
  return character.id
}

/** O 1 ponto de bônus: Expressão passa de 1 para 2 (Talentos 14/13). */
async function spendBonus(page: Page) {
  if (await page.getByRole('tab', { name: 'Talentos', exact: true }).count())
    await tab(page, 'Talentos')
  await page
    .getByRole('button', { name: 'Aumentar Expressão', exact: true })
    .click()
  const ok = page.getByRole('button', { name: 'Entendi' })
  if (await ok.isVisible().catch(() => false)) await ok.click()
  await expect(page.getByTestId('counter-talents')).toContainText('bônus')
}

interface Box {
  readonly x: number
  readonly width: number
}
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 0.5 &&
  inner.x + inner.width <= outer.x + outer.width + 0.5

/**
 * No desktop: título numa linha, inteiro, e o contador dentro da coluna. Nas
 * Habilidades (GroupsLayout), o título é o heading do grupo, com o contador
 * na mesma linha; nos Atributos (GridLayout), o rótulo em caixa alta, com o
 * contador abaixo. A coluna é o filho do corpo da seção.
 */
async function checkColumns(page: Page, label: string) {
  for (const [id, title] of GROUPS) {
    const help = page.getByTestId(`group-help-${id}`).first()
    await expect(help, `${label}: ? de ${title}`).toBeAttached()
    const metrics = await help.evaluate(el => {
      let col: HTMLElement | null = el as HTMLElement
      const isBody = (p: HTMLElement | null) =>
        Boolean(
          p?.dataset.testid?.endsWith('-body') ||
            p?.dataset.testid?.startsWith('grid-')
        )
      while (col?.parentElement && !isBody(col.parentElement))
        col = col.parentElement
      if (!col) return null
      const head =
        col.querySelector<HTMLElement>('[role="heading"][aria-level="3"]') ??
        (col.firstElementChild as HTMLElement | null)
      if (!head) return null
      const style = getComputedStyle(head)
      const lh = Number.parseFloat(style.lineHeight)
      const c = col.getBoundingClientRect()
      return {
        text: head.textContent ?? '',
        height: head.getBoundingClientRect().height,
        lineHeight: Number.isFinite(lh)
          ? lh
          : Number.parseFloat(style.fontSize) * 1.2,
        scroll: head.scrollWidth,
        client: head.clientWidth,
        column: { x: c.x, width: c.width },
      }
    })
    expect(metrics, `${label}: coluna de ${title}`).not.toBeNull()
    const m = metrics!
    expect(m.text.toLowerCase()).toBe(title.toLowerCase())
    expect
      .soft(
        m.height,
        `${label}: "${title}" numa linha (${m.height} px, linha de ${m.lineHeight})`
      )
      .toBeLessThanOrEqual(m.lineHeight * 1.5)
    expect
      .soft(m.scroll, `${label}: "${title}" sem corte`)
      .toBeLessThanOrEqual(m.client)
    const parts = [
      page.getByTestId(`counter-${id}`),
      page.getByTestId(`priority-help-${id}`),
      page.getByTestId(`group-help-${id}`),
      page.getByRole('radio', { name: new RegExp(`^${title}, `) }),
    ]
    for (const part of parts)
      for (const one of await part.all()) {
        const box = await one.boundingBox()
        if (!box) continue
        expect
          .soft(
            inside(box, m.column),
            `${label}: controle de ${title} dentro da coluna (${box.x}+${box.width} em ${m.column.x}+${m.column.width})`
          )
          .toBe(true)
      }
  }
}

async function noSideScroll(page: Page, label: string) {
  const { scroll, inner } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }))
  expect
    .soft(scroll, `${label}: sem rolagem lateral`)
    .toBeLessThanOrEqual(inner)
}

const STATES: readonly State[] = ['none', 'priorities', 'bonus']

for (const state of STATES)
  test(`N-06: cabeçalhos dos grupos no desktop, estado ${state}`, async ({
    browser,
    page,
  }) => {
    const id = await werewolf(browser, page.context(), state)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/characters/${id}?mode=create`)
    await page.getByRole('tab', { name: /^Ficha(, a seguir)?$/ }).click()
    if (state === 'bonus') await spendBonus(page)
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByTestId('section-abilities')).toBeVisible()
      await checkColumns(page, `${state} a ${width}`)
      await noSideScroll(page, `${state} a ${width}`)
    }
  })

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 } })
  for (const state of STATES)
    test(`N-06: a linha do contador contida a 390, estado ${state}`, async ({
      browser,
      page,
    }) => {
      const id = await werewolf(browser, page.context(), state)
      await page.goto(`/characters/${id}?mode=create`)
      if (state === 'bonus') await spendBonus(page)
      const screen = { x: 0, width: 390 }
      for (const [gid, title] of GROUPS) {
        await tab(page, title)
        const line = page.getByTestId(`creation-line-${gid}`)
        const box = await line.boundingBox()
        if (box)
          expect(inside(box, screen), `${state}: linha de ${title}`).toBe(true)
      }
      await noSideScroll(page, `${state} a 390`)
    })
})

test.describe('texto ampliado', () => {
  // 1280 com zoom de 200%: a mesma área de 640 px com o dobro de pixels
  test.use({ viewport: { width: 640, height: 900 }, deviceScaleFactor: 2 })
  test('N-06: com 200%, nenhum título quebra e nada vaza', async ({
    browser,
    page,
  }) => {
    const id = await werewolf(browser, page.context(), 'bonus')
    await page.goto(`/characters/${id}?mode=create`)
    await spendBonus(page)
    await noSideScroll(page, 'zoom 200%')
    for (const [gid, title] of GROUPS) {
      if (await page.getByRole('tab', { name: title, exact: true }).count())
        await tab(page, title)
      const heading = page.getByRole('heading', {
        name: title,
        exact: true,
        level: 3,
      })
      if (await heading.isVisible().catch(() => false)) {
        const { scroll, client } = await heading.evaluate(el => ({
          scroll: el.scrollWidth,
          client: el.clientWidth,
        }))
        expect(scroll, `zoom: "${title}" sem corte`).toBeLessThanOrEqual(client)
      }
      const line = page.getByTestId(`creation-line-${gid}`)
      const box = (await line.count()) ? await line.boundingBox() : null
      if (box)
        expect(inside(box, { x: 0, width: 640 }), `zoom: ${title}`).toBe(true)
    }
  })
})
