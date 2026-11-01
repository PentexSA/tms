import { type BrowserContext, expect, test } from '@playwright/test'
import { API_URL } from '../env'
import { apiAs, signUp } from '../support/users'

// L-02: um template mais novo que o bundle web (o dist velho do S-01, ou uma
// publicação que chegou antes do deploy do app) mostra "Recarregue a página"
// com o botão "Recarregar", e não "Atualize o app" sem saída. O schema do
// template é trocado na resposta da API, como o offline.spec faz com a rede.

const TEMPLATE = new RegExp(
  `^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/systems/[^/]+/template(\\?|$)`
)

async function newerTemplate(context: BrowserContext) {
  await context.route(TEMPLATE, async route => {
    const response = await route.fetch()
    const json = (await response.json()) as { schema: number }
    await route.fulfill({
      response,
      json: { ...json, schema: json.schema + 1 },
    })
  })
}

test('Nova ficha com template mais novo: "Recarregar" e, depois, o formulário', async ({
  page,
}) => {
  const context = page.context()
  const user = await signUp(context, 'tplnovo')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica do template novo', systemCode: 'vtm-v20' }
  )

  await newerTemplate(context)
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  await expect(
    page.getByRole('heading', { name: 'Recarregue a página' })
  ).toBeVisible()
  await expect(page.getByText('Atualize o app')).toHaveCount(0)

  // O app foi atualizado (aqui: a resposta volta ao normal) e "Recarregar"
  // busca a página de novo
  await context.unroute(TEMPLATE)
  await page.getByRole('button', { name: 'Recarregar' }).click()
  await expect(page.getByLabel('Nome (obrigatório)')).toBeVisible()
})
