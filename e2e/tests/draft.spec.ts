import { expect, type Page, test } from '@playwright/test'
import { apiAs, freeCreation, signUp } from '../support/users'

// T-03 (IW-01): o rascunho de Criação/Editar vivia só na memória e o F5
// apagava tudo, sem aviso. Agora fica no IndexedDB do usuário, volta com
// "Recuperar" e sai no logout.

const draftKeys = (page: Page) =>
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
    return keys.filter(k => k.includes(':draft:')).length
  })

test('F5 com 3 alterações em Editar: "Recuperar" devolve as 3; o logout apaga', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'rascunho')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica do rascunho', systemCode: 'vtm-v20' }
  )
  await freeCreation(context, user, chronicle.id)
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await page.getByLabel('Nome (obrigatório)').fill('Isadora Vex')
  await page.getByRole('radio', { name: 'Tremere' }).click()
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page.getByText('Editando · 0 alterações')).toBeVisible()

  for (const trait of ['Força', 'Destreza', 'Raciocínio'])
    await page
      .getByRole('button', { name: `Aumentar ${trait}`, exact: true })
      .click()
  await expect(page.getByText('Editando · 3 alterações')).toBeVisible()
  // T-17: o cabeçalho dizia "Salvo" com as 3 só no aparelho
  await expect(page.getByLabel(/^Sincronização: /)).toHaveAccessibleName(
    'Sincronização: 3 alterações não salvas'
  )
  await expect.poll(() => draftKeys(page)).toBe(1)

  // O F5: o navegador pergunta (beforeunload) e a pessoa aceita
  page.on('dialog', dialog => dialog.accept())
  await page.reload()

  await expect(
    page.getByText(/^Você tem 3 alterações não salvas nesta ficha/)
  ).toBeVisible()
  await page.getByRole('button', { name: 'Recuperar' }).click()
  await expect(page.getByText('Editando · 3 alterações')).toBeVisible()
  await page
    .getByRole('button', { name: 'Salvar alterações', exact: true })
    .click()
  await expect(page.getByText('Salvar 3 alterações?')).toBeVisible()
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  // Salvo e no outbox: o registro do aparelho sai
  await expect.poll(() => draftKeys(page)).toBe(0)

  // Um rascunho novo fica no aparelho até o logout
  await page.getByRole('radio', { name: 'Editar' }).click()
  await page
    .getByRole('button', { name: 'Aumentar Carisma', exact: true })
    .click()
  await expect.poll(() => draftKeys(page)).toBe(1)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sair' }).click()
  // O aviso de "Sair" do P02 conta o rascunho (sem valor de campo)
  await expect(
    page.getByText(
      'O rascunho não salvo de 1 ficha será descartado neste aparelho.'
    )
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sair e descartar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(() => draftKeys(page)).toBe(0)
})
