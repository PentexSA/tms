import { expect, type Page, test } from '@playwright/test'
import { API_URL, WEB_URL } from '../env'
import { apiAs, eighthGeneration, freeCreation, signUp } from '../support/users'

// Etapa 20: o jogo continua sem rede e sincroniza ao voltar.
//
// O web não tem service worker: com o navegador offline a própria página não
// recarrega. Para "recarregar sem rede", a página carrega e só a API fica
// inalcançável (route.abort), que é o que o app vê num túnel ou Wi-Fi ruim.

// As interações do Modo Jogo (Etapa 17), no computador (a partir de 600 não
// há dock: a seção "Em jogo" abre os mesmos sheets). Iguais ao play.spec.
async function spendBlood(page: Page) {
  await page
    .getByRole('button', { name: /^Pontos de Sangue, \d+ de \d+$/ })
    .click()
  await page.getByRole('button', { name: 'Gastar 1', exact: true }).click()
  await page.getByRole('button', { name: 'Fechar' }).last().click()
}

async function takeLethal(page: Page) {
  await page.getByRole('button', { name: /^Vitalidade: / }).click()
  await page.getByRole('button', { name: 'Aumentar Dano letal' }).click()
  await page.getByRole('button', { name: 'Fechar' }).last().click()
}

const indicator = (page: Page) => page.getByLabel(/^Sincronização: /)

test('gastar Sangue e levar dano offline, recarregar e sincronizar', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'offline')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica sem rede', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, user, chronicle.id)
  const character = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Helena Varga', clan: 'tremere' } }
  )
  await eighthGeneration(context, user, character.id)

  await page.goto(`/characters/${character.id}`)
  await expect(page.getByLabel('Pontos de Sangue, 15 de 15')).toBeVisible()
  await expect(indicator(page)).toHaveAccessibleName('Sincronização: Salvo')

  // 1. Sem rede: o que a pessoa faz vale na hora e fica no aparelho
  await context.setOffline(true)
  await expect(page.getByText('Sem conexão')).toBeVisible()
  await spendBlood(page)
  await takeLethal(page)
  await expect(page.getByLabel('Pontos de Sangue, 14 de 15')).toBeVisible()
  await expect(indicator(page)).toHaveAccessibleName(
    'Sincronização: Offline · 2 pendentes'
  )

  // 2. Recarregar sem alcançar a API: os valores continuam lá
  await context.route(`${API_URL}/**`, route =>
    route.abort('internetdisconnected')
  )
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByLabel('Pontos de Sangue, 14 de 15')).toBeVisible()
  await expect(indicator(page)).toHaveAccessibleName(
    'Sincronização: Offline · 2 pendentes'
  )

  // 3. A rede volta: os lotes são confirmados, na ordem
  await context.unroute(`${API_URL}/**`)
  // O evento "online" dispara o envio na hora (sem esperar o backoff)
  await context.setOffline(true)
  await context.setOffline(false)
  await expect(indicator(page)).toHaveAccessibleName('Sincronização: Salvo', {
    timeout: 15_000,
  })

  // O servidor ficou igual à tela
  const saved = await apiAs<{
    sheetVersion: number
    sheet: { values: Record<string, unknown> }
  }>(context, user, 'GET', `/characters/${character.id}`)
  // Geração foi o primeiro lote; Sangue e Vitalidade são mais dois lotes.
  expect(saved.sheetVersion).toBe(3)
  expect(saved.sheet.values.blood).toEqual({ current: 14 })
  expect(saved.sheet.values.health).toMatchObject({ lethal: 1 })
})

test('logout apaga o que ficou no aparelho', async ({ page }) => {
  const context = page.context()
  const user = await signUp(context, 'sair')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, user, chronicle.id)
  const character = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Caio' } }
  )
  await page.goto(`/characters/${character.id}`)
  await expect(page.getByLabel(/^Pontos de Sangue, /)).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await new Promise<string[]>(resolve => {
          const req = indexedDB.open('tms-offline', 1)
          req.onsuccess = () => {
            const tx = req.result.transaction('kv', 'readonly')
            const all = tx.objectStore('kv').getAllKeys()
            all.onsuccess = () => resolve(all.result.map(String))
          }
          req.onerror = () => resolve([])
        })
        return keys.filter(k => k.endsWith(':query-cache')).length
      })
    )
    .toBe(1)

  await page.goto('/')
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  // Só sobra o marcador de sessão, sem segredo nem dado do usuário (T-14)
  await expect
    .poll(() => deviceEntries(page))
    .toEqual([['session:state', 'signed-out']])
})

// O que o app guarda no IndexedDB do aparelho (chave e valor)
function deviceEntries(page: Page) {
  return page.evaluate(
    () =>
      new Promise<[string, string][]>(resolve => {
        const req = indexedDB.open('tms-offline', 1)
        req.onsuccess = () => {
          const entries: [string, string][] = []
          const tx = req.result.transaction('kv', 'readonly')
          const cursor = tx.objectStore('kv').openCursor()
          cursor.onsuccess = () => {
            const c = cursor.result
            if (!c) return resolve(entries)
            entries.push([String(c.key), String(c.value)])
            c.continue()
          }
        }
        req.onerror = () => resolve([])
      })
  )
}

const marker = async (page: Page) =>
  new Map(await deviceEntries(page)).get('session:state')

// T-14 (QAW-33): sair sem rede descartava a revogação; de volta à rede,
// recarregar entrava sozinho com o cookie antigo
test('logout sem rede: recarregar não entra sozinho e a revogação vai quando a rede volta', async ({
  page,
  request,
}) => {
  const context = page.context()
  await signUp(context, 'semrede')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Crônicas' })).toBeVisible()
  const old = (await context.cookies(`${API_URL}/auth`)).find(
    c => c.name === 'tms_refresh'
  )?.value
  expect(old).toBeTruthy()

  const refreshes: string[] = []
  page.on('request', r => {
    if (r.url().endsWith('/auth/refresh')) refreshes.push(r.url())
  })
  await page.route(`${API_URL}/**`, route => route.abort())
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(() => marker(page)).toBe('logout-pending')

  // Recarregar ainda sem rede: continua no login, sem tentar renovar
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  expect(await marker(page)).toBe('logout-pending')

  // A rede volta: a abertura revoga antes de qualquer outra coisa
  await page.unroute(`${API_URL}/**`)
  const revoked = page.waitForResponse(
    r => r.url().endsWith('/auth/logout') && r.status() === 204
  )
  await page.reload()
  await revoked
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(() => marker(page)).toBe('signed-out')
  expect(refreshes).toEqual([])

  // O cookie antigo já não renova no servidor
  const res = await request.post(`${API_URL}/auth/refresh`, {
    headers: { origin: WEB_URL, cookie: `tms_refresh=${old}` },
  })
  expect(res.status()).toBe(401)
})

test('logout sem rede, fechando a aba antes de a rede voltar', async ({
  page,
  request,
}) => {
  const context = page.context()
  await signUp(context, 'fechaaba')
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Crônicas' })).toBeVisible()
  const old = (await context.cookies(`${API_URL}/auth`)).find(
    c => c.name === 'tms_refresh'
  )?.value
  await page.route(`${API_URL}/**`, route => route.abort())
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(() => marker(page)).toBe('logout-pending')
  await page.close()

  // Outra aba, já com rede, de qualquer rota
  const next = await context.newPage()
  const revoked = next.waitForResponse(
    r => r.url().endsWith('/auth/logout') && r.status() === 204
  )
  await next.goto('/characters/qualquer')
  await revoked
  await expect(next).toHaveURL(/\/login$/)
  const res = await request.post(`${API_URL}/auth/refresh`, {
    headers: { origin: WEB_URL, cookie: `tms_refresh=${old}` },
  })
  expect(res.status()).toBe(401)
})
