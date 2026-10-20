import { randomUUID } from 'node:crypto'
import { expect, type Page, test } from '@playwright/test'
import { apiAs, signUp } from '../support/users'

// v1, Etapa 8: a jornada do §1 de doc/plano-v1.md, o Mago (M20) pelo mesmo
// motor do Vampiro. O jogador usa o celular (390: dock embaixo) e a
// narradora, o computador. A jornada do Vampiro (journey.spec.ts) roda junto.

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
const wheel = (page: Page) =>
  page.getByRole('button', { name: /^Quintessência e Paradoxo: / }).first()

test('a jornada da v1: o Mago, da crônica à magia', async ({
  page,
  browser,
}) => {
  test.slow()

  // 1. A narradora cria a crônica escolhendo Mago (M20) e gera o convite
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const st = await desk.newPage()
  const storyteller = await signUp(desk, 'narra')
  await st.goto('/')
  await st.getByRole('button', { name: 'Criar crônica' }).click()
  await st.getByLabel('Nome da crônica').fill('A Torre de Marfim')
  await st.getByRole('radio', { name: /Mago: A Ascensão/ }).click()
  await st.getByRole('button', { name: 'Criar crônica' }).click()
  await expect(
    st.getByRole('heading', { name: 'A Torre de Marfim' })
  ).toBeVisible()
  const chronicleUrl = st.url()
  await st.getByRole('button', { name: 'Convidar' }).click()
  await st.getByRole('button', { name: 'Gerar convite' }).click()
  const code = (await st.getByTestId('invite-code-value').innerText()).trim()

  // 2. O jogador entra com o convite e cria a ficha pelo formulário do
  // template do Mago
  await signUp(page.context(), 'joga')
  await page.goto('/')
  await page.getByRole('button', { name: 'Entrar com convite' }).click()
  await page.getByLabel('Código do convite').fill(code)
  await page.getByRole('button', { name: 'Entrar na crônica' }).click()
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  await page.getByLabel('Nome (obrigatório)').fill('Otto Brandt')
  await page.getByLabel('Natureza').fill('Inovador')
  await page.getByLabel('Comportamento').fill('Excêntrico')
  await page.getByLabel('Conceito').fill('Engenheiro de rádio')
  await page.getByRole('radio', { name: 'Filhos do Éter' }).click()
  await page.getByRole('radio', { name: 'Essência Questionadora' }).click()
  await page.getByLabel('Casa').fill('Engenheiros Etéricos')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}(\?mode=evolve)?$/)
  const id = /characters\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? ''

  // 3 e 4. Editar: Arete, Esferas (uma acima do Arete), afinidade e uma
  // rotina. A Esfera acima do teto fica inativa, e nenhum ponto se perde
  await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
  await page.getByRole('tab', { name: 'Vantagens' }).click()
  await stepper(page, 'Aumentar Arete').click()
  for (let i = 0; i < 3; i++) await stepper(page, 'Aumentar Forças').click()
  await expect(page.getByText('1 inativo, máx. pelo Arete 2')).toBeVisible()
  await page.getByRole('button', { name: /^Esfera de afinidade: / }).click()
  await page.getByRole('radio', { name: 'Forças' }).click()
  await expect(page.getByText('◆ Afinidade')).toBeVisible()
  await page.getByRole('button', { name: 'Adicionar Rotina' }).click()
  await page
    .getByRole('textbox', { name: 'Nome', exact: true })
    .fill('Bobina de bolso')
  await page
    .getByRole('button', { name: 'Adicionar “Bobina de bolso”' })
    .click()
  await expect(page.getByText('Editando · 4 alterações')).toBeVisible()

  await page.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.getByText('Salvar 4 alterações?')).toBeVisible()
  await expect(
    page.getByLabel('Forças, 1 inativo, máx. pelo Arete 2')
  ).toBeVisible()
  const evolved = batchSaved(page, id)
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  const evolveBatch = (await evolved).request().postDataJSON() as {
    events: unknown[]
  }
  expect(evolveBatch.events).toHaveLength(4)

  // 5. Jogo: o dock com Vitalidade, a roda e a FdV. Quintessência pela roda
  await page.getByRole('radio', { name: 'Jogo' }).click()
  await expect(wheel(page)).toHaveAccessibleName(
    /^Quintessência e Paradoxo: Quintessência 0, Paradoxo 0, de 20 casas/
  )
  await wheel(page).click()
  await stepper(page, 'Aumentar Quintessência').click()
  await stepper(page, 'Aumentar Quintessência').click()
  await close(page)
  await expect(indicator(page)).toHaveAccessibleName('Sincronização: Salvo', {
    timeout: 15_000,
  })

  // A narradora enche a roda (o Paradoxo de uma cena vulgar)
  await apiAs(desk, storyteller, 'POST', `/characters/${id}/events`, {
    clientBatchId: randomUUID(),
    events: [
      {
        path: 'values.wheel',
        from: { quintessence: 2, paradox: 0 },
        to: { quintessence: 5, paradox: 15 },
      },
    ],
  })
  await page.reload()
  await expect(wheel(page)).toHaveAccessibleName(
    /Quintessência 5, Paradoxo 15, de 20 casas/
  )

  // Roda cheia: a Quintessência não entra, e o Paradoxo novo consome uma
  // Quintessência, com aviso e Desfazer. Offline, e sincroniza ao voltar
  await page.context().setOffline(true)
  await expect(page.getByText('Sem conexão')).toBeVisible()
  await wheel(page).click()
  await expect(
    page.getByText('Sem casa livre: Quintessência não entra')
  ).toBeVisible()
  await stepper(page, 'Aumentar Paradoxo').click()
  await close(page)
  await expect(
    page.getByText('Sem casa livre: 1 Quintessência virou Paradoxo').first()
  ).toBeVisible()
  await expect(wheel(page)).toHaveAccessibleName(
    /Quintessência 4, Paradoxo 16, de 20 casas/
  )
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
  expect(synced.sheet.values.wheel).toEqual({ quintessence: 4, paradox: 16 })

  // 6. A narradora vê a roda na mesa e o Paradoxo no histórico
  await st.goto(chronicleUrl)
  await st.getByRole('tab', { name: 'Mesa' }).click()
  await expect(
    st.getByRole('button', { name: /^Otto Brandt, Filhos do Éter\./ })
  ).toHaveAccessibleName(/Quintessência 4, Paradoxo 16/)
  const history = await apiAs<{
    items: { changes: { label: string; change: string }[] }[]
  }>(desk, storyteller, 'GET', `/characters/${id}/history`)
  expect(history.items[0]?.changes).toEqual([
    {
      label: 'Quintessência e Paradoxo',
      change: 'Quintessência 5 → 4, Paradoxo 15 → 16',
    },
  ])

  // 7. A magia: o atalho "Conjurar efeito" monta a parada de Arete
  await page.getByRole('button', { name: 'Dados', exact: true }).click()
  await page.getByRole('button', { name: 'Conjurar efeito' }).click()
  await expect(page.getByLabel(/^Parada: 2 dados/)).toBeVisible()
  await stepper(page, 'Aumentar Dificuldade').click()
  await page.getByRole('button', { name: 'Rolar no app' }).click()
  await expect(
    page.getByText(/^(\d+ sucessos?|Falha|Falha crítica)$/).first()
  ).toBeVisible()
  const rolls = await apiAs<{
    items: { label: string; difficulty: number }[]
  }>(desk, storyteller, 'GET', `/characters/${id}/rolls`)
  expect(rolls.items[0]).toMatchObject({
    label: 'Conjurar efeito: Arete',
    difficulty: 7,
  })
  await desk.close()
})
