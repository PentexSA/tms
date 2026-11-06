import { randomUUID } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { API_URL } from '../env'
import {
  apiAs,
  completeCreation,
  freeCreation,
  rawAs,
  signUp,
} from '../support/users'

// U-11 (P16-D): o narrador revela as Notas do Narrador à dona da ficha e as
// deixa privadas de novo. A dona lê só em leitura, pela rota própria; o texto
// nunca vai ao IndexedDB do aparelho; outro jogador não lê. Texto fictício.

const SENTINEL = 'SENTINELA-P16 nota de teste do roteiro'

/** Todas as chaves e valores do IndexedDB do app, em texto. */
const indexedDbText = (page: Page) =>
  page.evaluate(async () => {
    const names = (await indexedDB.databases()).map(d => d.name ?? '')
    const out: string[] = []
    for (const name of names) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      for (const store of Array.from(db.objectStoreNames)) {
        const all = await new Promise<unknown[]>((resolve, reject) => {
          const req = db.transaction(store).objectStore(store).getAll()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const keys = await new Promise<unknown[]>((resolve, reject) => {
          const req = db.transaction(store).objectStore(store).getAllKeys()
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        out.push(JSON.stringify(keys), JSON.stringify(all))
      }
      db.close()
    }
    return out.join('\n')
  })

test('o narrador revela e esconde as notas; a dona lê só em leitura, sem cache em disco', async ({
  browser,
  page,
}) => {
  const context = page.context()
  await page.setViewportSize({ width: 1280, height: 800 })
  const storyteller = await signUp(context, 'narra16')
  const chronicle = await apiAs<{ id: string }>(
    context,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica da Revelação', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, storyteller, chronicle.id)
  const invite = () =>
    apiAs<{ code: string }>(
      context,
      storyteller,
      'POST',
      `/chronicles/${chronicle.id}/invites`,
      {}
    )

  const ownerContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const owner = await signUp(ownerContext, 'dona16')
  await apiAs(ownerContext, owner, 'POST', '/invites/accept', {
    code: (await invite()).code,
  })
  const character = await apiAs<{ id: string }>(
    ownerContext,
    owner,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Ficha Revelada', clan: 'tremere' } }
  )
  await completeCreation(context, storyteller, character.id)
  // A sentinela nas notas, como o narrador escreveria
  await apiAs(
    context,
    storyteller,
    'POST',
    `/characters/${character.id}/events`,
    {
      clientBatchId: randomUUID(),
      events: [{ path: 'values.storytellerNotes', from: null, to: SENTINEL }],
    }
  )

  // 1. Antes: a ficha da dona não tem a sentinela nem o bloco
  const sheet = await ownerContext.newPage()
  const firstBody = sheet.waitForResponse(
    r => r.url() === `${API_URL}/characters/${character.id}`
  )
  await sheet.goto(`/characters/${character.id}`)
  expect(await (await firstBody).text()).not.toContain(SENTINEL)
  await sheet.getByRole('tab', { name: 'Sobre' }).click()
  await expect(sheet.getByText(/reveladas pelo narrador/)).toHaveCount(0)

  // 2. O narrador revela, pela aba "Sobre", com confirmação
  let reveals = 0
  page.on('request', r => {
    if (r.url().endsWith('/reveal') && r.method() === 'POST') reveals++
  })
  await page.goto(`/characters/${character.id}`)
  await page.getByRole('tab', { name: 'Sobre' }).click()
  await page.getByRole('button', { name: /^Revelar ao jogador/ }).click()
  const panel = page
    .getByTestId('bottom-sheet-root')
    .locator('[aria-modal="true"]')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('reveal-notes-text')).toContainText(SENTINEL)
  // Esc fecha sem enviar
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  expect(reveals).toBe(0)
  await page.getByRole('button', { name: /^Revelar ao jogador/ }).click()
  await page.getByRole('button', { name: 'Revelar notas' }).click()
  await expect(panel).toBeHidden()
  await expect(
    page.getByText(/^Notas reveladas a .*, só leitura\.$/)
  ).toBeVisible()
  expect(reveals).toBe(1)
  await expect(
    page.getByText(`Notas do Narrador · reveladas: ${owner.username} lê`)
  ).toBeVisible()

  // 3. A dona lê, só em leitura; o IndexedDB não tem a sentinela
  await sheet.reload()
  await sheet.getByRole('tab', { name: 'Sobre' }).click()
  await expect(
    sheet.getByText('Notas do Narrador · reveladas pelo narrador')
  ).toBeVisible()
  await expect(sheet.getByText(SENTINEL)).toBeVisible()
  await expect(
    sheet.getByRole('button', { name: /Editar Notas do Narrador/ })
  ).toHaveCount(0)
  expect(await indexedDbText(sheet)).not.toContain(SENTINEL)

  // 6. Offline com a nota revelada: a ficha abre do cache, sem a sentinela
  await ownerContext.setOffline(true)
  await sheet.reload().catch(() => undefined)
  await ownerContext.route(`${API_URL}/**`, route =>
    route.abort('internetdisconnected')
  )
  await ownerContext.setOffline(false)
  await sheet.reload()
  await sheet.getByRole('tab', { name: 'Sobre' }).click()
  await expect(
    sheet.getByText('Conecte-se para ler as notas reveladas.')
  ).toBeVisible()
  await expect(sheet.getByText(SENTINEL)).toHaveCount(0)
  await ownerContext.unroute(`${API_URL}/**`)

  // 4. O narrador esconde; a dona volta à aba e o bloco some
  await page.getByRole('button', { name: /^Deixar privadas/ }).click()
  await expect(
    page.getByText(
      'As notas voltaram a ser privadas. Quem já leu continua sabendo.'
    )
  ).toBeVisible()
  await sheet.reload()
  await sheet.getByRole('tab', { name: 'Sobre' }).click()
  await expect(sheet.getByText(/reveladas pelo narrador/)).toHaveCount(0)
  await expect(sheet.getByText(SENTINEL)).toHaveCount(0)
  const after = await apiAs<{ sections: unknown[] }>(
    ownerContext,
    owner,
    'GET',
    `/characters/${character.id}/revealed`
  )
  expect(after.sections).toEqual([])
  // O Histórico da dona: os dois passos, sem a edição das notas
  const history = await apiAs<{ items: { event?: string }[] }>(
    ownerContext,
    owner,
    'GET',
    `/characters/${character.id}/history`
  )
  expect(
    history.items.map(i => i.event).filter(e => e?.startsWith('section.'))
  ).toEqual(['section.hidden', 'section.revealed'])
  expect(JSON.stringify(history)).not.toContain('Notas do Narrador')

  // 5. Outro jogador da crônica: 404 na rota da nota revelada
  const otherContext = await browser.newContext()
  const other = await signUp(otherContext, 'outro16')
  await apiAs(otherContext, other, 'POST', '/invites/accept', {
    code: (await invite()).code,
  })
  const res = await rawAs(
    otherContext,
    other,
    'GET',
    `/characters/${character.id}/revealed`
  )
  expect(res.status()).toBe(404)

  await otherContext.close()
  await ownerContext.close()
})
