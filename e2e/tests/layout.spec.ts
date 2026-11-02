import {
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'
import { apiAs, freeCreation, signUp } from '../support/users'

// P08 da onda 2: layout e teclado no web (react-native-web), com a CSP de
// produção. Só contas fictícias (signUp) e crônicas pela API.
// T-11 (cabeçalho cabe, "Mais opções"), T-27 (faixa fixa), T-59 ("Em jogo"
// recolhido), T-26 (Enter no login), T-67 (margens), T-65 (identidade),
// T-28 (grupos lado a lado) e T-69 (folha central no desktop).

const PHONE = { width: 390, height: 844 }
const NARROW = { width: 360, height: 780 }
const DESKTOP = { width: 1280, height: 900 }

/** Uma crônica do narrador com um jogador e a ficha dele em criação. */
async function table(
  storytellerContext: BrowserContext,
  playerContext: BrowserContext,
  prefix: string,
  { free = false }: { readonly free?: boolean } = {}
) {
  const storyteller = await signUp(storytellerContext, `${prefix}_n`)
  const chronicle = await apiAs<{ id: string }>(
    storytellerContext,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica do layout', systemCode: 'vtm-v20' }
  )
  if (free) await freeCreation(storytellerContext, storyteller, chronicle.id)
  const { code } = await apiAs<{ code: string }>(
    storytellerContext,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`
  )
  const player = await signUp(playerContext, `${prefix}_j`)
  await apiAs(playerContext, player, 'POST', '/invites/accept', { code })
  const character = await apiAs<{ id: string }>(
    playerContext,
    player,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Helena Varga', clan: 'tremere' } }
  )
  return { storyteller, player, chronicle, character }
}

const sideScroll = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  )

async function inViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  const size = page.viewportSize()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(size!.width + 0.5)
}

// A folha, não a raiz do Modal do react-native-web (que também é
// aria-modal e ocupa a tela inteira)
const sheetDialog = (page: Page) =>
  page.getByTestId('bottom-sheet-root').locator('[aria-modal="true"]')

/**
 * Rola até a seção começar logo abaixo da faixa fixa: a faixa passa a
 * mostrar as sub-abas dela (T-27).
 */
const scrollToSection = (page: Page, section: string) =>
  page.getByTestId(`section-${section}`).evaluate(el => {
    let scroller = el.parentElement
    while (scroller && scroller.scrollHeight <= scroller.clientHeight)
      scroller = scroller.parentElement
    if (!scroller) return
    const nav = document.querySelector('[data-testid="sheet-nav"]')
    scroller.scrollTop +=
      el.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top -
      (nav?.getBoundingClientRect().height ?? 0)
  })

for (const size of [PHONE, NARROW])
  test(`T-11 a ${size.width}: o cabeçalho cabe, com "Mais opções", para a dona e o narrador`, async ({
    browser,
  }) => {
    const desk = await browser.newContext({ viewport: size })
    const phone = await browser.newContext({ viewport: size })
    try {
      const { character } = await table(desk, phone, `cab${size.width}`)
      const page = await phone.newPage()
      await page.goto(`/characters/${character.id}?mode=create`)
      await expect(
        page.getByRole('heading', { name: 'Helena Varga' })
      ).toBeVisible()
      // Uma alteração não salva: o texto mais longo do cabeçalho (T-17)
      // No web, o nome da célula leva o valor ("Conceito: vazio")
      await page.getByRole('button', { name: /^Conceito:/ }).click()
      await page.getByRole('textbox', { name: 'Conceito' }).fill('Arquivista')
      // T-10: Enter aplica na folha de uma linha
      await page.keyboard.press('Enter')
      await expect(
        page.getByText('1 alteração', { exact: false }).first()
      ).toBeVisible()
      await expect.poll(() => sideScroll(page)).toBeLessThanOrEqual(0)
      const more = page.getByRole('button', { name: 'Mais opções' })
      await inViewport(page, more)
      await expect(
        page.getByRole('button', { name: 'Histórico', exact: true })
      ).toHaveCount(0)
      await more.click()
      await expect(
        page.getByRole('heading', { name: 'Mais opções' })
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /^Ações do narrador/ })
      ).toHaveCount(0)
      await page.getByRole('button', { name: 'Histórico', exact: true }).click()
      await expect(
        page.getByRole('heading', { name: 'Histórico de alterações' })
      ).toBeVisible()
      await page.keyboard.press('Escape')

      // O narrador na ficha do jogador: o estado no item e as ações
      const st = await desk.newPage()
      await st.goto(`/characters/${character.id}`)
      await expect(
        st.getByRole('heading', { name: 'Helena Varga' })
      ).toBeVisible()
      await expect.poll(() => sideScroll(st)).toBeLessThanOrEqual(0)
      await inViewport(st, st.getByRole('button', { name: 'Mais opções' }))
      await st.getByRole('button', { name: 'Mais opções' }).click()
      await st
        // O estado da ficha (P04-D): por pontos, o padrão do V20
        .getByRole('button', {
          name: 'Ações do narrador · Em criação · por pontos',
        })
        .click()
      await expect(
        st.getByRole('heading', { name: 'Ações do narrador' })
      ).toBeVisible()
      await expect(
        st.getByRole('button', { name: 'Concluir criação' })
      ).toBeVisible()
    } finally {
      await desk.close()
      await phone.close()
    }
  })

test('T-27 e T-59 a 390: "Em jogo" recolhido; abas e sub-abas fixas na Criação', async ({
  browser,
}) => {
  const desk = await browser.newContext({ viewport: DESKTOP })
  const phone = await browser.newContext({ viewport: PHONE })
  try {
    const { character } = await table(desk, phone, 'faixa')
    const page = await phone.newPage()
    await page.goto(`/characters/${character.id}?mode=create`)
    const playToggle = page.getByRole('button', { name: 'Em jogo' })
    await expect(playToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(
      page.getByRole('tablist', { name: 'Partes da ficha' })
    ).toBeVisible()

    // No topo, as sub-abas dos Atributos
    await expect(
      page.getByRole('tablist', { name: 'Grupos de Atributos' })
    ).toBeVisible()
    // Rola até as Habilidades: a faixa fica no topo, com as sub-abas delas
    await scrollToSection(page, 'abilities')
    await expect(
      page.getByRole('tablist', { name: 'Grupos de Atributos' })
    ).toHaveCount(0)
    const groups = page.getByRole('tablist', { name: 'Grupos de Habilidades' })
    await expect(groups).toBeVisible()
    await inViewport(page, groups)
    await inViewport(page, page.getByRole('tab', { name: 'Perícias' }))
    const budget = page.getByRole('tab', { name: 'Orçamento' })
    await inViewport(page, budget)
    // "Orçamento" sem voltar ao topo
    await budget.click()
    await expect(budget).toHaveAttribute('aria-selected', 'true')
  } finally {
    await desk.close()
    await phone.close()
  }
})

test('T-26: Enter no e-mail do login leva à senha', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('login-email').fill('ninguem@example.test')
  await page.getByTestId('login-email').press('Enter')
  await expect(page.getByTestId('login-password')).toBeFocused()
})

test('T-67 a 390: títulos da crônica e dos Bastidores com a margem da página', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: PHONE })
  try {
    const user = await signUp(context, 'margem')
    const chronicle = await apiAs<{ id: string }>(
      context,
      user,
      'POST',
      '/chronicles',
      { name: 'Crônica das margens', systemCode: 'vtm-v20' }
    )
    const page = await context.newPage()
    await page.goto(`/chronicles/${chronicle.id}`)
    const members = page.getByRole('heading', { name: 'Participantes' })
    await expect(members).toBeVisible()
    expect((await members.boundingBox())!.x).toBeGreaterThanOrEqual(16)
    const invite = (await page
      .getByRole('button', { name: 'Convidar' })
      .boundingBox())!
    expect(invite.x + invite.width).toBeLessThanOrEqual(PHONE.width - 16 + 0.5)
    await page.getByRole('tab', { name: 'Bastidores' }).click()
    const diary = page.getByRole('heading', { name: 'Diário da crônica' })
    await expect(diary).toBeVisible()
    expect((await diary.boundingBox())!.x).toBeGreaterThanOrEqual(16)
  } finally {
    await context.close()
  }
})

test('T-65 a 390: "Comportamento" numa linha só no Editar', async ({
  browser,
}) => {
  const desk = await browser.newContext({ viewport: DESKTOP })
  const phone = await browser.newContext({ viewport: PHONE })
  try {
    const { character } = await table(desk, phone, 'ident', { free: true })
    const page = await phone.newPage()
    await page.goto(`/characters/${character.id}?mode=evolve`)
    await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
    const label = page.getByText('Comportamento', { exact: true }).first()
    await expect(label).toBeVisible()
    expect((await label.boundingBox())!.height).toBeLessThan(1.5 * 22)
  } finally {
    await desk.close()
    await phone.close()
  }
})

test('T-28 a 1280: Talentos, Perícias e Conhecimentos lado a lado no Editar', async ({
  browser,
}) => {
  const desk = await browser.newContext({ viewport: DESKTOP })
  const player = await browser.newContext({ viewport: DESKTOP })
  try {
    const { character } = await table(desk, player, 'colunas', { free: true })
    const page = await player.newPage()
    await page.goto(`/characters/${character.id}?mode=evolve`)
    await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
    const boxes = []
    for (const name of ['Talentos', 'Perícias', 'Conhecimentos']) {
      const heading = page.getByRole('heading', { name, exact: true })
      await expect(heading).toBeVisible()
      boxes.push((await heading.boundingBox())!)
    }
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThanOrEqual(4)
    expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThanOrEqual(4)
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x)
    expect(boxes[1]!.x).toBeLessThan(boxes[2]!.x)
  } finally {
    await desk.close()
    await player.close()
  }
})

for (const [size, centered] of [
  [DESKTOP, true],
  [PHONE, false],
] as const)
  test(`T-69 a ${size.width}: "Convidar" ${centered ? 'abre um diálogo central de até 560' : 'abre a folha presa embaixo'}; Esc devolve o foco (T-71)`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: size })
    try {
      const user = await signUp(context, `folha${size.width}`)
      const chronicle = await apiAs<{ id: string }>(
        context,
        user,
        'POST',
        '/chronicles',
        { name: 'Crônica da folha', systemCode: 'vtm-v20' }
      )
      const page = await context.newPage()
      await page.goto(`/chronicles/${chronicle.id}`)
      const invite = page.getByRole('button', { name: 'Convidar' })
      // Pelo teclado: o clique não foca botão no WebKit do macOS
      await invite.focus()
      await page.keyboard.press('Enter')
      const dialog = sheetDialog(page)
      await expect(dialog).toBeVisible()
      // A animação de entrada termina antes de medir
      await expect
        .poll(async () => (await dialog.boundingBox())?.y ?? -1)
        .toBeGreaterThan(0)
      const box = (await dialog.boundingBox())!
      if (centered) {
        expect(box.width).toBeLessThanOrEqual(560)
        expect(
          Math.abs(box.x + box.width / 2 - size.width / 2)
        ).toBeLessThanOrEqual(2)
      } else {
        expect(box.width).toBeGreaterThan(size.width - 2)
        expect(box.y + box.height).toBeGreaterThan(size.height - 2)
      }
      await expect(page.getByRole('button', { name: 'Fechar' })).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(invite).toBeFocused()
    } finally {
      await context.close()
    }
  })
