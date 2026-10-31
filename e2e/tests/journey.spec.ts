import { expect, type Page, test } from '@playwright/test'
import { apiAs, freeCreation, signUp } from '../support/users'

// Etapa 22: a jornada do §1 de doc/plano-v0.md inteira, num cenário só, pela
// tela. A jogadora usa o celular (390 de largura: dock embaixo) e o narrador,
// o computador. Só o cadastro do narrador vai pela API: o de tela tem rate
// limit por IP, e o auth.spec já usa o dele.

test.use({ viewport: { width: 390, height: 844 } })

const PASSWORD = 'correct horse battery staple'
const SECRET = 'O Regente vai cobrar.'

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

test('a jornada da v0, da conta à rolagem', async ({ page, browser }) => {
  test.slow()

  // 2. O narrador cria a crônica de Vampiro (V20) e gera um convite
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const st = await desk.newPage()
  const storyteller = await signUp(desk, 'narra')
  await st.goto('/')
  await st.getByRole('button', { name: 'Criar crônica' }).click()
  await st.getByLabel('Nome da crônica').fill('Crônica da Liberdade')
  // Com Vampiro e Mago publicados, o sistema é escolhido (v1)
  const vampire = st.getByRole('radio', { name: /Vampiro: A Máscara/ })
  await vampire.click()
  await expect(vampire).toBeChecked()
  await st.getByRole('button', { name: 'Criar crônica' }).click()
  await expect(
    st.getByRole('heading', { name: 'Crônica da Liberdade' })
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

  // 1. A jogadora cria a conta pela tela e entra
  const username = `joga_${Date.now().toString(36)}`.slice(0, 24)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  // O login também tem "E-mail": preencher antes da troca de tela perde o
  // texto (no CI, mais lento, acontecia)
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible()
  await page.getByLabel('E-mail').fill(`${username}@example.test`)
  await page.getByLabel('Nome de usuário').fill(username)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('heading', { name: 'Crônicas' })).toBeVisible()

  // 3. Entra na crônica com o código
  await page.getByRole('button', { name: 'Entrar com convite' }).click()
  await page.getByLabel('Código do convite').fill(code)
  await page.getByRole('button', { name: 'Entrar na crônica' }).click()
  await expect(
    page.getByText(`Narrador: ${storyteller.username}`, { exact: true })
  ).toBeVisible()

  // 4. A ficha pelo formulário gerado do template
  await page.getByRole('button', { name: 'Nova ficha' }).click()
  await page.getByLabel('Nome (obrigatório)').fill('Helena Varga')
  await page.getByLabel('Conceito').fill('Arquivista da Capela')
  await page.getByRole('radio', { name: 'Tremere' }).click()
  await page.getByLabel('Senhor').fill('Ana Bathory')
  await page.getByLabel('Natureza').fill('Arquiteta')
  await page.getByLabel('Comportamento').fill('Conformista')
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  await expect(page).toHaveURL(/\/characters\/[0-9a-f-]{36}(\?mode=evolve)?$/)
  const id = /characters\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? ''
  // O ?mode=evolve vale só na chegada: recarregar abre no modo do papel
  await expect(page).toHaveURL(new RegExp(`/characters/${id}$`))

  // 5. Evoluir: atributos, habilidades, especialização, FdV, disciplinas e
  // antecedentes; Salvar grava UM lote
  await expect(page.getByText('Editando · 0 alterações')).toBeVisible()
  await stepper(page, 'Aumentar Força').click()
  await stepper(page, 'Aumentar Destreza').click()
  await stepper(page, 'Aumentar Destreza').click()
  await stepper(page, 'Aumentar Esportes').click()
  await page
    .getByRole('button', { name: 'Adicionar especialização em Destreza' })
    .click()
  await page
    .getByRole('textbox', { name: 'Especialização', exact: true })
    .fill('Reflexos')
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await stepper(page, 'Aumentar Força de Vontade permanente').click()
  await page.getByRole('tab', { name: 'Vantagens' }).click()
  await page.getByRole('button', { name: 'Adicionar Disciplina' }).click()
  await page.getByLabel('Buscar Disciplina').fill('tauma')
  await page.getByRole('button', { name: 'Taumaturgia', exact: true }).click()
  await page.getByRole('button', { name: 'Adicionar Antecedente' }).click()
  await page.getByLabel('Buscar Antecedente').fill('rebanho')
  await page.getByRole('button', { name: 'Rebanho', exact: true }).click()
  // Geração 5 (da 13ª para a 8ª): Sangue máximo 15. Mesmo caminho
  // (values.backgrounds) do Rebanho: segue sendo 1 alteração
  await page.getByRole('button', { name: 'Adicionar Antecedente' }).click()
  await page.getByLabel('Buscar Antecedente').fill('gera')
  await page.getByRole('button', { name: 'Geração', exact: true }).click()
  await page.getByRole('button', { name: /^Geração, 1 de 5/ }).click()
  for (let i = 0; i < 4; i++)
    await stepper(page, 'Aumentar Geração, valor').click()
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Editando · 7 alterações')).toBeVisible()

  await page.getByRole('button', { name: 'Concluir' }).click()
  await expect(page.getByText('Salvar 7 alterações?')).toBeVisible()
  const evolved = batchSaved(page, id)
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  const evolveBatch = (await evolved).request().postDataJSON() as {
    events: unknown[]
  }
  expect(evolveBatch.events).toHaveLength(7)

  // 6. Jogo (identidade, 3 abas e o dock: Vitalidade, Sangue, FdV). A dona não
  // tem Leitura: Jogo já mostra a ficha inteira
  await expect(page.getByRole('radio', { name: 'Leitura' })).toHaveCount(0)
  await expect(
    page.getByRole('tab').filter({ hasText: /Ficha|Vantagens|Sobre/ })
  ).toHaveCount(3)
  await page.getByRole('radio', { name: 'Jogo' }).click()
  const blood = page.getByRole('button', {
    name: /^Pontos de Sangue, \d+ de 15\. Toque longo: Gastar 1 Sangue$/,
  })
  await expect(blood).toHaveAccessibleName(/^Pontos de Sangue, 15 de 15\./)
  await expect(
    page.getByRole('button', { name: /^Vitalidade: Sem ferimentos/ })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /^Força de Vontade, / })
  ).toBeVisible()

  // 7. Em jogo e offline: gastar Sangue, levar dano letal, curar com Sangue,
  // despertar e desfazer. Tudo vale na hora e sincroniza ao reconectar
  await page.context().setOffline(true)
  await expect(page.getByText('Sem conexão')).toBeVisible()
  await blood.click({ delay: 800 })
  await expect(page.getByText('Sangue 15 → 14')).toBeVisible()

  await page.getByRole('button', { name: /^Vitalidade: / }).click()
  await page.getByRole('button', { name: 'Aumentar Dano letal' }).click()
  await close(page)
  await expect(
    page.getByRole('button', { name: /^Vitalidade: .*1 letal$/ })
  ).toBeVisible()

  await blood.click()
  await page
    .getByRole('button', { name: 'Curar 1 nível de dano (1 Sangue)' })
    .click()
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await close(page)
  await expect(
    page.getByRole('button', { name: /^Vitalidade: Sem ferimentos/ })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Ações da ficha' }).click()
  await page.getByRole('button', { name: 'Despertar (nova noite)' }).click()
  await page.getByRole('button', { name: 'Aplicar' }).click()
  await expect(blood).toHaveAccessibleName(/^Pontos de Sangue, 12 de 15\./)
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(blood).toHaveAccessibleName(/^Pontos de Sangue, 13 de 15\./)
  await expect(indicator(page)).toHaveAccessibleName(
    'Sincronização: Offline · 5 pendentes'
  )

  await page.context().setOffline(false)
  await expect(indicator(page)).toHaveAccessibleName('Sincronização: Salvo', {
    timeout: 15_000,
  })
  const synced = await apiAs<{
    sheetVersion: number
    sheet: { values: Record<string, unknown> }
  }>(desk, storyteller, 'GET', `/characters/${id}`)
  // Criação (0), Evoluir (1) e os 5 lotes do jogo, na ordem
  expect(synced.sheetVersion).toBe(6)
  expect(synced.sheet.values.blood).toEqual({ current: 13 })

  // 8. O narrador vê a mesa e edita a ficha, assinado no histórico; as Notas
  // do Narrador nunca chegam ao aparelho da jogadora
  await st.goto(chronicleUrl)
  await st.getByRole('tab', { name: 'Mesa' }).click()
  const row = st.getByRole('button', { name: /^Helena Varga, Tremere\./ })
  await expect(row).toHaveAccessibleName(/Pontos de Sangue, 13 de 15/)
  await row.click()
  await st.getByRole('button', { name: 'Editar como narrador' }).click()
  await st.getByRole('button', { name: /^Vitalidade: / }).click()
  const hurt = batchSaved(st, id)
  await st.getByRole('button', { name: 'Aumentar Dano contusivo' }).click()
  await hurt
  await close(st)
  await st.getByRole('button', { name: 'Editar Notas do Narrador' }).click()
  await st
    .getByRole('textbox', { name: 'Notas do Narrador', exact: true })
    .fill(SECRET)
  const noted = batchSaved(st, id)
  await st.getByRole('button', { name: 'Salvar', exact: true }).click()
  await noted
  await st.getByRole('button', { name: 'Histórico' }).click()
  await expect(
    st.getByText(`${storyteller.username} (narrador)`, { exact: false })
  ).toHaveCount(2)

  const fetched = page.waitForResponse(
    r => r.url().endsWith(`/characters/${id}`) && r.request().method() === 'GET'
  )
  await page.reload()
  expect(await (await fetched).text()).not.toContain('Regente')
  await expect(
    page.getByRole('button', { name: /^Vitalidade: .*1 contusivo/ })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Histórico' }).click()
  await expect(
    page.getByText(`${storyteller.username} (narrador)`, { exact: false })
  ).toHaveCount(1)
  await expect(page.getByText(/Notas do Narrador/)).toHaveCount(0)
  await close(page)

  // 9. A rolagem: Atributo + Habilidade, dificuldade, especialização e FdV
  await page.getByRole('button', { name: 'Dados', exact: true }).click()
  await page.getByRole('button', { name: /^Atributo:/ }).click()
  await page.getByLabel('Buscar atributo').fill('destreza')
  await page
    .getByRole('button', {
      name: 'Destreza, 3, especialização Reflexos',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: /^Habilidade ou Disciplina:/ }).click()
  await page.getByLabel('Buscar habilidade ou disciplina').fill('esportes')
  await page.getByRole('button', { name: 'Esportes, 1', exact: true }).click()
  await page
    .getByRole('checkbox', {
      name: 'Usar especialização (10 conta 2 sucessos)',
    })
    .click()
  await page
    .getByRole('checkbox', {
      name: 'Gastar 1 Força de Vontade: +1 sucesso automático',
    })
    .click()
  await expect(page.getByLabel(/^Parada: 4 dados/)).toBeVisible()
  await page.getByRole('button', { name: 'Rolar no app' }).click()
  await expect(
    page.getByText(/^(\d+ sucessos?|Falha|Falha crítica)$/).first()
  ).toBeVisible()

  const rolls = await apiAs<{ items: { label: string; manual: boolean }[] }>(
    desk,
    storyteller,
    'GET',
    `/characters/${id}/rolls`
  )
  expect(rolls.items[0]).toMatchObject({
    label: 'Destreza + Esportes',
    manual: false,
  })
  await desk.close()
})
