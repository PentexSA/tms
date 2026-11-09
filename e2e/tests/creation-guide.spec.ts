import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import {
  ALMOST,
  newCharacter,
  PRIORITIES,
  plus,
  pointsChronicle,
  prepared,
  tab,
  type User,
} from '../support/creation'
import { apiAs } from '../support/users'

// P05-D (D-05): o guia da criação por pontos. O "Faltam: …" na barra, ao
// lado do "Salvar", com itens que levam ao grupo; a aba "Pontos"; a linha do
// próximo passo que muda quando a conta fecha; a fase em texto; a folha de
// bônus uma vez por ficha. Só UX: a conta continua decidida no servidor.
// Contas fictícias (signUp), crônica vtm-v20 no padrão do template.

// Só faltam as Virtudes (os 7 pontos básicos)
const VIRTUES = {
  ...ALMOST,
  stamina: 3,
  conscience: 1,
  selfControl: 1,
  courage: 1,
}

const minus = (page: Page, trait: string) =>
  page.getByRole('button', { name: `Diminuir ${trait}`, exact: true })

const guide = (page: Page) =>
  page.getByTestId('mode-bar').getByTestId('creation-guide')

/** Só as prioridades, sem pontos (o servidor confere, como no app). */
const withPriorities = (context: BrowserContext, user: User, id: string) =>
  apiAs(context, user, 'PATCH', `/characters/${id}/creation`, {
    revision: 0,
    choices: { priorities: PRIORITIES },
  })

async function sheet(
  browser: Parameters<typeof pointsChronicle>[0],
  page: Page,
  values: Record<string, unknown> | null
) {
  const context = page.context()
  const { chronicleId, user } = await pointsChronicle(browser, context)
  const character = await newCharacter(context, user, chronicleId)
  if (values) await prepared(context, user, character.id, values)
  else await withPriorities(context, user, character.id)
  await page.goto(`/characters/${character.id}?mode=create`)
  await expect(page.getByTestId('mode-bar')).toBeVisible()
  return { context, user, chronicleId, id: character.id }
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
]) {
  test(`"Faltam" na barra a ${viewport.width}: alvos de 44 e a altura de sempre`, async ({
    browser,
    page,
  }) => {
    await page.setViewportSize(viewport)
    await sheet(browser, page, VIRTUES)
    await expect(guide(page)).toContainText('Falta:')
    const item = page.getByRole('button', { name: /^Virtudes 7:/ })
    await expect(item).toBeVisible()
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    // O "Faltam" ocupa o lugar do "Concluir", antes do "Salvar"
    await expect(page.getByTestId('creation-action')).toHaveCount(0)
    const bar = (await page.getByTestId('mode-bar').boundingBox())!
    expect(bar.height).toBeLessThanOrEqual(112)
    // Nada da barra passa da largura da tela
    const overflow = await page
      .getByTestId('mode-bar')
      .evaluate(
        el =>
          Array.from(el.querySelectorAll('*')).filter(
            c => c.getBoundingClientRect().right > window.innerWidth + 0.5
          ).length
      )
    expect(overflow).toBe(0)
  })
}

test.describe('a 390', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('tocar um item leva ao grupo, logo abaixo da faixa, com o foco no título', async ({
    browser,
    page,
  }) => {
    await sheet(browser, page, VIRTUES)
    await page.getByRole('button', { name: /^Virtudes 7:/ }).click()
    await expect(
      page.getByRole('tab', { name: 'Vantagens', exact: true })
    ).toHaveAttribute('aria-selected', 'true')
    const anchor = page.locator('#anchor-advantages-virtues')
    await expect(anchor).toBeFocused()
    await expect(anchor).toBeInViewport()
    // O começo do grupo fica abaixo da faixa fixa, não embaixo dela
    await expect
      .poll(async () => {
        const nav = (await page.getByTestId('sheet-nav').boundingBox())!
        const box = (await anchor.boundingBox())!
        return box.y - (nav.y + nav.height)
      })
      .toBeGreaterThanOrEqual(-1)
  })

  test('conta fechada: o "Faltam" sai, o "Concluir" entra e a linha muda', async ({
    browser,
    page,
  }) => {
    await sheet(browser, page, ALMOST)
    await expect(page.getByTestId('next-step')).toHaveText(
      'Você conclui quando a conta fechar.'
    )
    await plus(page, 'Vigor').click()
    await page.getByRole('button', { name: 'Entendi' }).click()
    await expect(guide(page)).toHaveCount(0)
    await expect(page.getByTestId('creation-action')).toContainText(
      'Concluir criação'
    )
    await expect(page.getByTestId('next-step')).toHaveText(
      'A conta fechou: você conclui.'
    )
  })

  test('a folha de bônus abre uma vez: nem ao tirar e repor, nem depois de recarregar', async ({
    browser,
    page,
  }) => {
    await sheet(browser, page, ALMOST)
    await plus(page, 'Vigor').click()
    await expect(page.getByTestId('bonus-notice')).toBeVisible()
    await page.getByRole('button', { name: 'Entendi' }).click()
    await expect(page.getByTestId('bonus-notice')).toHaveCount(0)
    await minus(page, 'Vigor').click()
    await plus(page, 'Vigor').click()
    await expect(page.getByText(/Bônus: restam 15 de 15/)).toBeVisible()
    await expect(page.getByTestId('bonus-notice')).toHaveCount(0)
    // Salva (o servidor fica com o Vigor 3) e recarrega: outro store, a
    // mesma marca no aparelho (IndexedDB)
    await page.getByTestId('mode-save').click()
    await page
      .getByTestId('bottom-sheet-root')
      .getByRole('button', { name: 'Salvar', exact: true })
      .click()
    await expect(page.getByText(/^Salvo:/)).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('creation-action')).toBeVisible()
    await minus(page, 'Vigor').click()
    await expect(page.getByTestId('creation-action')).toHaveCount(0)
    await plus(page, 'Vigor').click()
    await expect(page.getByTestId('creation-action')).toBeVisible()
    await expect(page.getByTestId('bonus-notice')).toHaveCount(0)
  })

  test('a fase é texto; a troca manual é um botão secundário', async ({
    browser,
    page,
  }) => {
    await sheet(browser, page, null)
    await tab(page, 'Pontos')
    const panel = page.getByTestId('creation-panel')
    await expect(panel.getByTestId('creation-phase')).toHaveText(
      'Fase: pontos básicos'
    )
    await expect(panel.getByRole('radio')).toHaveCount(0)
    await panel
      .getByRole('button', { name: 'Usar pontos de bônus agora' })
      .click()
    await expect(panel.getByTestId('creation-phase')).toHaveText(
      'Fase: pontos de bônus'
    )
  })
})

test('a 360: "e mais N" leva à aba Pontos, com o foco no "O que falta"', async ({
  browser,
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await sheet(browser, page, null)
  const more = guide(page).getByRole('button', { name: /^e mais \d+:/ })
  await expect(more).toBeVisible()
  await more.click()
  await expect(
    page.getByRole('tab', { name: 'Pontos', exact: true })
  ).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#anchor-creation-missing')).toBeFocused()
  // A lista inteira, um botão por item
  await expect(
    page.getByTestId('creation-problems').getByRole('button')
  ).toHaveCount(9)
})

test('a 1280: a folha de bônus é o diálogo de 560; Esc fecha e o foco volta ao "+"; "Ver Pontos" troca de aba depois', async ({
  browser,
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const { context, user, chronicleId } = await sheet(browser, page, ALMOST)
  await plus(page, 'Vigor').click()
  // O painel, não a camada da folha (lição da onda 3)
  const dialog = page
    .getByTestId('bottom-sheet-root')
    .locator('[aria-modal="true"]')
  await expect(dialog.getByText('Começaram os pontos de bônus')).toBeVisible()
  await expect
    .poll(async () => (await dialog.boundingBox())?.y ?? -1)
    .toBeGreaterThan(0)
  const box = (await dialog.boundingBox())!
  expect(box.width).toBeLessThanOrEqual(560)
  expect(Math.abs(box.x + box.width / 2 - 1280 / 2)).toBeLessThanOrEqual(2)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('bonus-notice')).toHaveCount(0)
  await expect(plus(page, 'Vigor')).toBeFocused()

  // Outra ficha (a primeira já tem a marca): "Ver Pontos"
  const other = await newCharacter(context, user, chronicleId)
  await prepared(context, user, other.id, ALMOST)
  await page.goto(`/characters/${other.id}?mode=create`)
  await plus(page, 'Vigor').click()
  await page.getByRole('button', { name: 'Ver Pontos' }).click()
  await expect(page.getByTestId('bonus-notice')).toHaveCount(0)
  await expect(
    page.getByRole('tab', { name: 'Pontos', exact: true })
  ).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('creation-phase')).toHaveText(
    'Fase: pontos de bônus'
  )
})
