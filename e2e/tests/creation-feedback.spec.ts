import { expect, type Page, test } from '@playwright/test'
import {
  ALMOST,
  newCharacter,
  plus,
  pointsChronicle,
  prepared,
  tab,
} from '../support/creation'
import { apiAs, signUp } from '../support/users'

// P05-C: o feedback da conta na criação por pontos, a 390 px. Cada recusa
// diz o motivo certo, ao lado do toque, e some quando a causa some; o "+"
// mostra a trava antes do toque; o saldo diz o que resta; o extrato diz onde
// foram os bônus; "Criar ficha" leva ao campo com erro. Só UX: a conta
// continua decidida no servidor (apps/api/src/__tests__/creation.test.ts).
//
// Crônica vtm-v20 no padrão do template (por pontos, aprovação desligada),
// contas fictícias. A 390 px, os grupos de Atributos e de Habilidades viram
// abas (groupTabs.tsx), e a conta fica na aba Pontos.

test.use({ viewport: { width: 390, height: 844 } })

// O "+" bloqueado pela previsão é aria-disabled e continua tocável (R-20):
// sem o `disabled` do <button>, a pessoa clica. O Playwright não clica num
// elemento aria-disabled sem `force`
const pressBlocked = async (page: Page, trait: string) => {
  await expect(plus(page, trait)).not.toHaveAttribute('disabled')
  await plus(page, trait).click({ force: true })
}

test('Nova ficha: Criar ficha leva ao nome (T-21)', async ({ page }) => {
  const context = page.context()
  const user = await signUp(context, 'sem_nome_t21')
  const chronicle = await apiAs<{ id: string }>(
    context,
    user,
    'POST',
    '/chronicles',
    { name: 'Crônica', systemCode: 'vtm-v20' }
  )
  await page.goto(`/chronicles/${chronicle.id}/new-character`)
  // O Playwright rola até o botão, no fim do formulário
  await page.getByRole('button', { name: 'Criar ficha' }).click()
  const name = page.getByLabel('Nome (obrigatório)')
  await expect(name).toBeFocused()
  await expect(name).toBeInViewport()
  await expect(page.getByRole('alert')).toContainText('Informe o nome')
})

test('Pontos básicos: motivo certo, ao lado do toque, e some com a causa (T-07, T-20, T-55, R-28)', async ({
  browser,
  page,
}) => {
  const context = page.context()
  const { chronicleId, user } = await pointsChronicle(browser, context)
  const character = await newCharacter(context, user, chronicleId)
  await page.goto(`/characters/${character.id}?mode=create`)

  // Sem prioridade: o aviso pede a escolha, ao lado da Força
  await pressBlocked(page, 'Força')
  await expect(page.getByTestId('notice-strength')).toContainText(
    'Físicos: escolha a prioridade antes de distribuir os pontos.'
  )
  // Escolher Físicos marca os outros grupos, avisa quem mudou (R-28) e
  // apaga o aviso da Força, sem aplicar o ponto (T-55)
  await page
    .getByRole('radio', { name: 'Físicos, Primária, 7 pontos', exact: true })
    .click()
  await expect(page.getByText(/Sociais ficou Secundária \(5\)/)).toBeVisible()
  await expect(page.getByTestId('notice-strength')).toHaveCount(0)

  // Mentais (Terciária, 3): no terceiro ponto o "+" fica com cara de
  // indisponível, mas o toque ainda explica, ao lado e dentro da tela (T-20)
  await tab(page, 'Mentais')
  for (let i = 0; i < 3; i++) await plus(page, 'Raciocínio').click()
  await expect(plus(page, 'Raciocínio')).toHaveAttribute(
    'aria-disabled',
    'true'
  )
  await pressBlocked(page, 'Raciocínio')
  const wits = page.getByTestId('notice-wits')
  await expect(wits).toContainText('Mentais: os 3 pontos básicos')
  await expect(wits).toBeInViewport()

  // Talentos (Primária, 13): o 4º ponto em Prontidão diz o teto, não o
  // grupo, com o contador ainda em 3/13 (T-07)
  await tab(page, 'Talentos')
  await page
    .getByRole('radio', { name: 'Talentos, Primária, 13 pontos', exact: true })
    .click()
  for (let i = 0; i < 3; i++) await plus(page, 'Prontidão').click()
  await pressBlocked(page, 'Prontidão')
  const alert = page.getByTestId('notice-alertness')
  await expect(alert).toContainText('vai até 3')
  await expect(alert).not.toContainText('já foram usados')
  await expect(page.getByTestId('counter-talents')).toContainText('3/13')
  // O aviso anterior sumiu: um aviso só por ficha
  await expect(page.getByTestId('notice-wits')).toHaveCount(0)
})

test('Bônus: com os básicos completos, o saldo diz o que resta (T-18)', async ({
  browser,
  page,
}) => {
  const context = page.context()
  const { chronicleId, user } = await pointsChronicle(browser, context)
  const character = await newCharacter(context, user, chronicleId)
  await prepared(context, user, character.id, ALMOST)
  await page.goto(`/characters/${character.id}?mode=create`)

  // O último ponto básico abre o aviso dos bônus
  await plus(page, 'Vigor').click()
  await page.getByRole('button', { name: 'Entendi' }).click()
  await expect(page.getByText(/Bônus: restam 15 de 15/)).toBeVisible()
  await tab(page, 'Pontos')
  await expect(page.getByTestId('creation-ready')).toContainText(
    'restam 15 de bônus'
  )
  await expect(page.getByTestId('creation-action')).toContainText(
    'Concluir criação'
  )
  // A confirmação de concluir diz a sobra, e concluir continua permitido
  await page.getByTestId('creation-action').click()
  await expect(page.getByTestId('completion-message')).toContainText(
    'Sobram 15 pontos de bônus. Eles não viram XP.'
  )
  await expect(page.getByTestId('creation-confirm')).toBeEnabled()
  await page.getByRole('button', { name: 'Voltar', exact: true }).click()
})

test('Bônus: o custo do toque e o extrato (T-57, R-17)', async ({
  browser,
  page,
}) => {
  const context = page.context()
  const { chronicleId, user } = await pointsChronicle(browser, context)
  const character = await newCharacter(context, user, chronicleId)
  // Básicos completos e 14 de 15 bônus gastos: Força 5 e Destreza 4 (10),
  // FdV 5 (2, parte de 3 pela Coragem) e Humanidade 8 (2, parte de 7)
  await prepared(context, user, character.id, {
    ...ALMOST,
    stamina: 3,
    strength: 5,
    dexterity: 4,
    willpower: { permanent: 5, current: 5 },
    humanity: 8,
  })
  await page.goto(`/characters/${character.id}?mode=create`)

  // Briga acima do teto custa 2, e resta 1: o "+" já avisa, e o toque diz
  // quanto falta, o custo e o saldo
  await tab(page, 'Talentos')
  await expect(page.getByTestId('counter-talents')).toContainText(
    '13/13 · +1 = 2 bônus'
  )
  await expect(plus(page, 'Briga')).toHaveAttribute('aria-disabled', 'true')
  await pressBlocked(page, 'Briga')
  await expect(page.getByTestId('notice-brawl')).toContainText(
    'Faltaria 1 de bônus: custa 2, resta 1.'
  )

  // A FdV diz o custo do próximo ponto na linha; na Criação, "Em jogo"
  // começa recolhido (T-59)
  await page.getByRole('button', { name: 'Em jogo' }).click()
  await expect(page.getByTestId('advice-willpower')).toContainText(
    '+1 = 1 bônus'
  )

  await tab(page, 'Pontos')
  const ledger = page.getByTestId('creation-ledger')
  await expect(ledger).toContainText('Atributos › Físicos: 2 × 5 = 10')
  await expect(ledger).toContainText('Força de Vontade: 2 × 1 = 2')
  await expect(ledger).toContainText('parte de 3, que vem de Coragem')
  await expect(page.getByTestId('creation-ledger-total')).toContainText(
    'Gastos 14 · resta 1 de 15'
  )
})
