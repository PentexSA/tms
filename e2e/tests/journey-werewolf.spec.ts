import { randomUUID } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { apiAs, freeCreation, signUp } from '../support/users'

// v2, Etapa 7: a jornada do §1 de doc/plano-v2.md, o Lobisomem (W20) pelo
// mesmo motor do Vampiro e do Mago. O jogador usa o celular (390: dock
// embaixo) e a narradora, o computador. As jornadas do Vampiro e do Mago
// rodam junto.

test.use({ viewport: { width: 390, height: 844 } })

/** O lote chega ao servidor (a fila manda em segundo plano). */
const batchSaved = (page: Page, id: string) =>
  page.waitForResponse(
    r =>
      r.url().endsWith(`/characters/${id}/events`) &&
      r.request().method() === 'POST' &&
      r.status() === 200
  )

const indicator = (page: Page) => page.getByLabel(/^Sincronização: /)
const close = (page: Page) =>
  page.getByRole('button', { name: 'Fechar' }).last().click()
const stepper = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true })
const form = (page: Page) =>
  page.getByRole('button', { name: /^Forma: / }).first()

test('a jornada da v2: o Lobisomem, da crônica à forma Crinos', async ({
  page,
  browser,
}) => {
  test.slow()

  // 1. A narradora cria a crônica escolhendo Lobisomem (W20) e gera o convite
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const st = await desk.newPage()
  const storyteller = await signUp(desk, 'narra')
  await st.goto('/')
  await st.getByRole('button', { name: 'Criar crônica' }).click()
  await st.getByLabel('Nome da crônica').fill('Seita da Serra do Mar')
  await st.getByRole('radio', { name: /Lobisomem: O Apocalipse/ }).click()
  await st.getByRole('button', { name: 'Criar crônica' }).click()
  await expect(
    st.getByRole('heading', { name: 'Seita da Serra do Mar' })
  ).toBeVisible()
  const chronicleUrl = st.url()
  // A jornada não trata da conta por pontos: a crônica cria em modo livre
  await freeCreation(
    desk,
    storyteller,
    /chronicles\/([0-9a-f-]{36})/.exec(chronicleUrl)![1]!
  )
  await st.getByRole('button', { name: 'Convidar' }).click()
  await st.getByRole('button', { name: 'Gerar convite' }).click()
  const code = (await st.getByTestId('invite-code-value').innerText()).trim()

  // 2. O jogador entra com o convite e cria a ficha pelo formulário do
  // template do Lobisomem
  await signUp(page.context(), 'joga')
  await page.goto('/')
  await page.getByRole('button', { name: 'Entrar com convite' }).click()
  await page.getByLabel('Código do convite').fill(code)
  await page.getByRole('button', { name: 'Entrar na crônica' }).click()
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  await page.getByLabel('Nome (obrigatório)').fill('Iara Moreira')
  await page.getByLabel('Nome de feito').fill('Canta-Tempestade')
  await page.getByLabel('Conceito').fill('Contadora de histórias')
  await page.getByRole('radio', { name: 'Hominídeo', exact: true }).click()
  await page.getByRole('radio', { name: /^Galliard/ }).click()
  await page.getByRole('radio', { name: 'Fianna', exact: true }).click()
  await page.getByLabel('Seita', { exact: true }).fill('Seita da Serra do Mar')
  await page.getByLabel('Totem da matilha').fill('Corvo')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}(\?mode=evolve)?$/)
  const id = /characters\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? ''

  // 3. Editar: Força e um Dom. Salvar grava UM lote
  await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
  await stepper(page, 'Aumentar Força').click()
  await stepper(page, 'Aumentar Força').click()
  await page.getByRole('tab', { name: 'Vantagens' }).click()
  await page.getByRole('button', { name: 'Adicionar Dom' }).click()
  await page
    .getByRole('textbox', { name: 'Nome', exact: true })
    .fill('Persuasão')
  await page.getByRole('button', { name: 'Adicionar “Persuasão”' }).click()
  await expect(page.getByText('Editando · 2 alterações')).toBeVisible()
  await page.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.getByText('Salvar 2 alterações?')).toBeVisible()
  const evolved = batchSaved(page, id)
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  const evolveBatch = (await evolved).request().postDataJSON() as {
    events: unknown[]
  }
  expect(evolveBatch.events).toHaveLength(2)

  // A narradora marca a Fúria da ficha (3 de 4)
  await apiAs(desk, storyteller, 'POST', `/characters/${id}/events`, {
    clientBatchId: randomUUID(),
    events: [
      {
        path: 'values.rage',
        from: null,
        to: { current: 3, permanent: 4 },
      },
    ],
  })

  // 4 e 9. Jogo, offline: o dock com Vitalidade, Fúria e Forma. Crinos com a
  // mudança instantânea, num lote só, com aviso e Desfazer
  await page.reload()
  await page.getByRole('radio', { name: 'Jogo' }).click()
  await expect(form(page)).toHaveAccessibleName(/^Forma: Hominídeo/)
  await page.context().setOffline(true)
  await expect(page.getByText('Sem conexão')).toBeVisible()
  await form(page).click()
  await page
    .getByRole('switch', { name: 'Mudança instantânea: gastar 1 Fúria' })
    .click()
  await page.getByRole('radio', { name: /^Crinos/ }).click()
  await expect(
    page.getByText('Humanos que veem a forma Crinos sofrem o Delírio.')
  ).toBeVisible()
  await close(page)
  await expect(page.getByText('Forma: Crinos (1 Fúria)').first()).toBeVisible()
  await expect(form(page)).toHaveAccessibleName(/^Forma: Crinos/)

  // 5. A grade mostra o efetivo e a origem; o gravado continua 3
  await expect(
    page.getByLabel('Força, 7, base 3 mais 4 em Crinos').first()
  ).toBeVisible()
  await expect(page.getByText('3 + 4 Crinos').first()).toBeVisible()

  await page.context().setOffline(false)
  await expect(indicator(page)).toHaveAccessibleName('Sincronização: Salvo', {
    timeout: 15_000,
  })
  const synced = await apiAs<{ sheet: { values: Record<string, unknown> } }>(
    desk,
    storyteller,
    'GET',
    `/characters/${id}`
  )
  expect(synced.sheet.values).toMatchObject({
    form: 'crinos',
    rage: { current: 2, permanent: 4 },
    strength: 3,
  })

  // 6. A rolagem em Crinos. O atalho Teste de Fúria monta a parada do
  // permanente; escolher a Força desliga o atalho, e a parada usa o efetivo
  await page.getByRole('button', { name: 'Dados', exact: true }).click()
  await page.getByRole('button', { name: 'Teste de Fúria' }).click()
  await expect(page.getByLabel(/^Parada: 4 dados/)).toBeVisible()
  await page.getByRole('button', { name: /^Atributo:/ }).click()
  await page.getByLabel('Buscar atributo').fill('força')
  await page.getByRole('button', { name: /^Força, 7, Crinos \+4/ }).click()
  await expect(
    page.getByLabel('Parada: 7 dados. Força: Crinos +4')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Rolar no app' }).click()
  await expect(
    page.getByText(/^(\d+ sucessos?|Falha|Falha crítica)$/).first()
  ).toBeVisible()
  await close(page)
  const rolls = await apiAs<{
    items: { label: string; dice: number }[]
  }>(desk, storyteller, 'GET', `/characters/${id}/rolls`)
  expect(rolls.items[0]).toMatchObject({ label: 'Força', dice: 7 })

  // 7. Dano letal da narradora, e Regenerar pelo menu da ficha
  await apiAs(desk, storyteller, 'POST', `/characters/${id}/events`, {
    clientBatchId: randomUUID(),
    events: [
      {
        path: 'values.health',
        from: null,
        to: { aggravated: 1, lethal: 1, bashing: 0 },
      },
    ],
  })
  await page.reload()
  await page.getByRole('button', { name: 'Ações da ficha' }).click()
  await page.getByRole('button', { name: 'Regenerar 1 nível' }).click()
  const regenerated = batchSaved(page, id)
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await regenerated
  await expect(indicator(page)).toHaveAccessibleName('Sincronização: Salvo', {
    timeout: 15_000,
  })
  const healed = await apiAs<{ sheet: { values: Record<string, unknown> } }>(
    desk,
    storyteller,
    'GET',
    `/characters/${id}`
  )
  expect(healed.sheet.values.health).toEqual({
    aggravated: 1,
    lethal: 0,
    bashing: 0,
  })

  // 8. A narradora vê a forma na mesa e a troca no histórico
  await st.goto(chronicleUrl)
  await st.getByRole('tab', { name: 'Mesa' }).click()
  await expect(
    st.getByRole('button', { name: /^Iara Moreira, Fianna\./ })
  ).toHaveAccessibleName(/Forma: Crinos/)
  const history = await apiAs<{
    items: { changes: { label: string; change: string }[] }[]
  }>(desk, storyteller, 'GET', `/characters/${id}/history`)
  const swap = history.items.find(i => i.changes.some(c => c.label === 'Forma'))
  expect(swap?.changes).toEqual([
    { label: 'Forma', change: 'Hominídeo → Crinos' },
    { label: 'Fúria', change: '3 → 2' },
  ])
  await desk.close()
})
