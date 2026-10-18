import { expect, type Page, test } from '@playwright/test'
import { API_URL } from '../env'
import { apiAs, signUp } from '../support/users'

// Etapa 20: o jogo continua sem rede e sincroniza ao voltar.
//
// O web não tem service worker: com o navegador offline a própria página não
// recarrega. Para "recarregar sem rede", a página carrega e só a API fica
// inalcançável (route.abort), que é o que o app vê num túnel ou Wi-Fi ruim.

// As interações do Modo Jogo (Etapa 17). Ficam aqui para ajustar num lugar só.
async function spendBlood(page: Page) {
  await page.getByRole('button', { name: /^Sangue/ }).click()
  await page.getByRole('button', { name: 'Gastar 1' }).click()
  await page.getByRole('button', { name: 'Fechar' }).first().click()
}

async function takeLethal(page: Page) {
  await page.getByRole('button', { name: /^Vitalidade/ }).click()
  await page.getByRole('button', { name: 'Aumentar Letal' }).click()
  await page.getByRole('button', { name: 'Fechar' }).first().click()
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
  const character = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicle.id}/characters`,
    { values: { name: 'Helena Varga', clan: 'tremere', generation: 8 } }
  )

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
  expect(saved.sheetVersion).toBe(2)
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
        return keys
      })
    )
    .toEqual([])
})
