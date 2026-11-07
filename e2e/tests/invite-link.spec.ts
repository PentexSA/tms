import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// P12, D-14: o convite por link (`/join#<código>`). O código lido da tela
// fica só numa variável: nunca em console.log, nome de teste ou anexo.
// Toda captura mascara o código e o link.

const mask = (page: Page) => [
  page.getByTestId('invite-code-value'),
  page.getByTestId('invite-link-value'),
  page.getByLabel('Código do convite'),
]
test.use({ screenshot: 'off' })

async function storytellerWithChronicle(context: BrowserContext) {
  const storyteller = await signUp(context, 'narra')
  const chronicle = await apiAs<{ id: string }>(
    context,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Cronica do Link', systemCode: 'vtm-v20' }
  )
  return { storyteller, chronicleId: chronicle.id }
}

/** Gera pela tela e devolve o link e o código (só em variável). */
async function generate(page: Page, chronicleId: string) {
  await page.goto(`/chronicles/${chronicleId}`)
  await page.getByRole('button', { name: 'Convidar' }).click()
  await page.getByRole('button', { name: 'Gerar convite' }).click()
  const link = (await page.getByTestId('invite-link-value').innerText()).trim()
  const code = link.slice(link.indexOf('#') + 1)
  return { link, code }
}

const formatted = (code: string) => code.replace(/(.{4})(?=.)/g, '$1 ')

test('o link abre Entrar com convite preenchido e some da URL', async ({
  browser,
  page,
}) => {
  const { chronicleId } = await storytellerWithChronicle(page.context())
  const { link, code } = await generate(page, chronicleId)

  const context = await browser.newContext()
  const player = await signUp(context, 'jogador')
  const join = await context.newPage()
  await join.goto(link)
  await expect(join).toHaveURL(/\/join$/)
  expect(await join.evaluate(() => location.hash)).toBe('')
  await expect(join.getByLabel('Código do convite')).toHaveValue(code)
  await expect(
    join.getByText(`Você vai entrar como ${player.username}.`)
  ).toBeVisible()
  await join.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(join).toHaveURL(new RegExp(`/chronicles/${chronicleId}`))
  await join.goBack()
  expect(join.url()).not.toContain('#')
  await context.close()
})

test('sem sessão: login, depois o convite', async ({ browser, page }) => {
  const { chronicleId } = await storytellerWithChronicle(page.context())
  const { link, code } = await generate(page, chronicleId)

  // A conta existe (criada em outro contexto); este começa sem cookie
  const owner = await browser.newContext()
  const player = await signUp(owner, 'semsessao')
  await owner.close()
  const context = await browser.newContext()
  const join = await context.newPage()
  await join.goto(link)
  await expect(join).toHaveURL(/\/login$/)
  await expect(
    join.getByText('Você recebeu um convite para uma crônica.', {
      exact: false,
    })
  ).toBeVisible()
  await expect(join.getByText(code)).toHaveCount(0)
  await expect(join.getByText(formatted(code))).toHaveCount(0)
  await join.getByLabel('E-mail').fill(`${player.username}@example.test`)
  await join.getByLabel('Senha').fill('correct horse battery staple')
  await join.getByRole('button', { name: 'Entrar' }).click()
  await expect(join).toHaveURL(/\/join$/)
  await expect(join.getByLabel('Código do convite')).toHaveValue(code)
  await join.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(join).toHaveURL(new RegExp(`/chronicles/${chronicleId}`))
  await context.close()
})

test('o código não sai da página: nem URL, nem referer, nem console', async ({
  browser,
  page,
}) => {
  const { chronicleId } = await storytellerWithChronicle(page.context())
  const { link, code } = await generate(page, chronicleId)

  const context = await browser.newContext()
  await signUp(context, 'vigiado')
  const join = await context.newPage()
  const seen: string[] = []
  join.on('request', request => {
    seen.push(request.url(), request.headers().referer ?? '')
  })
  join.on('console', message => seen.push(message.text()))
  await join.goto(link)
  await join.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(join).toHaveURL(new RegExp(`/chronicles/${chronicleId}`))
  const all = seen.join('\n')
  // Sem imprimir o código se falhar: só o resultado da busca
  expect(all.includes(code)).toBe(false)
  expect(all.includes(formatted(code))).toBe(false)
  await context.close()
})

test.describe('T-44: sem Web Share API', () => {
  test('"Copiar mensagem", "Copiado ✓" e nenhum pageerror', async ({
    page,
  }) => {
    const errors: Error[] = []
    page.on('pageerror', error => errors.push(error))
    await page.context().addInitScript(() => {
      // biome-ignore lint/suspicious/noExplicitAny: apagar a API no navegador
      const nav = navigator as any
      delete nav.share
      delete nav.canShare
      Object.defineProperty(Navigator.prototype, 'share', { value: undefined })
      Object.defineProperty(Navigator.prototype, 'canShare', {
        value: undefined,
      })
    })
    const { chronicleId } = await storytellerWithChronicle(page.context())
    await generate(page, chronicleId)
    await expect(
      page.getByRole('button', { name: 'Compartilhar', exact: true })
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Copiar mensagem', exact: true })
      .click()
    await expect(page.getByTestId('invite-copy-status')).toHaveText(
      'Mensagem copiada.'
    )
    expect(errors).toEqual([])
  })

  test('Web Share que recusa (NotAllowedError) copia, sem pageerror', async ({
    page,
  }) => {
    const errors: Error[] = []
    page.on('pageerror', error => errors.push(error))
    await page.context().addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'share', {
        value: () =>
          Promise.reject(new DOMException('recusado', 'NotAllowedError')),
      })
    })
    const { chronicleId } = await storytellerWithChronicle(page.context())
    await generate(page, chronicleId)
    await page
      .getByRole('button', { name: 'Compartilhar', exact: true })
      .click()
    await expect(page.getByTestId('invite-copy-status')).toContainText(
      'A mensagem foi copiada.'
    )
    expect(errors).toEqual([])
  })
})

test('T-43: "Copiado ✓" à vista, a 390 e a 1280', async ({ page }) => {
  const { chronicleId } = await storytellerWithChronicle(page.context())
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 })
    await generate(page, chronicleId)
    await page.getByRole('button', { name: 'Copiar link' }).click()
    const copied = page.getByRole('button', { name: 'Copiado' })
    await expect(copied).toHaveText('Copiado ✓')
    const onTop = await copied.evaluate(el => {
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2
      )
      return hit === el || el.contains(hit)
    })
    expect(onTop).toBe(true)
    await page.screenshot({ mask: mask(page) }).catch(() => undefined)
  }
})

test('T-45: revogar pede confirmação, com o foco', async ({ page }) => {
  const { storyteller, chronicleId } = await storytellerWithChronicle(
    page.context()
  )
  for (let i = 0; i < 2; i++)
    await apiAs(
      page.context(),
      storyteller,
      'POST',
      `/chronicles/${chronicleId}/invites`
    )
  const deletes: string[] = []
  page.on('request', r => {
    if (r.method() === 'DELETE') deletes.push(r.url())
  })
  await page.goto(`/chronicles/${chronicleId}`)
  await page.getByRole('button', { name: 'Convidar' }).click()
  await expect(page.getByText(/^Convite 1 · criado em .* às /)).toBeVisible()
  await expect(page.getByText(/^Convite 2 · criado em .* às /)).toBeVisible()
  // Pelo teclado (focus + Enter), como no layout.spec.ts
  const trigger = page.getByRole('button', { name: 'Revogar convite 1' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  const cancel = page.getByRole('button', { name: 'Cancelar' })
  await expect(cancel).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(trigger).toBeFocused()
  expect(deletes).toEqual([])
  await trigger.focus()
  await page.keyboard.press('Enter')
  await page
    .getByRole('button', { name: 'Revogar convite', exact: true })
    .click()
  await expect(page.getByText(/^Convite 1 · /)).toHaveCount(0)
  expect(deletes).toHaveLength(1)
  await expect(
    page.getByRole('heading', { name: 'Convites ativos' })
  ).toBeFocused()
})

test('um convite revogado, pelo link, dá a mensagem genérica', async ({
  browser,
  page,
}) => {
  const { chronicleId } = await storytellerWithChronicle(page.context())
  const { link } = await generate(page, chronicleId)
  await page.getByRole('button', { name: /^Revogar convite \d+$/ }).click()
  await page
    .getByRole('button', { name: 'Revogar convite', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /^Revogar convite \d+$/ })
  ).toHaveCount(0)

  const context = await browser.newContext()
  await signUp(context, 'atrasado')
  const join = await context.newPage()
  await join.goto(link)
  await join.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(join.getByRole('alert')).toContainText(
    'Este convite não vale mais ou o código está errado'
  )
  await context.close()
})
