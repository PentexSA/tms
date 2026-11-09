import { randomUUID } from 'node:crypto'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { apiAs, signUp } from './users'

// Ajudantes da criação por pontos (V20), comuns aos specs da conta
// (creation-feedback), de Salvar × Concluir (save-finish) e do estado da
// ficha. Só contas fictícias (signUp) e dados preparados pela API, que o
// servidor confere como confere o app.

export type User = Awaited<ReturnType<typeof signUp>>

/**
 * Narrador cria a crônica vtm-v20 no padrão do template (por pontos,
 * aprovação desligada); o jogador entra pelo convite.
 */
export async function pointsChronicle(
  browser: Browser,
  player: BrowserContext
) {
  const desk = await browser.newContext()
  const storyteller = await signUp(desk, 'narra_conta')
  const chronicle = await apiAs<{ id: string }>(
    desk,
    storyteller,
    'POST',
    '/chronicles',
    { name: 'Crônica da conta', systemCode: 'vtm-v20' }
  )
  const { code } = await apiAs<{ code: string }>(
    desk,
    storyteller,
    'POST',
    `/chronicles/${chronicle.id}/invites`
  )
  await desk.close()
  const user = await signUp(player, 'joga_conta')
  await apiAs(player, user, 'POST', '/invites/accept', { code })
  return { chronicleId: chronicle.id, user, storyteller }
}

export const newCharacter = (
  context: BrowserContext,
  user: User,
  chronicleId: string
) =>
  apiAs<{ id: string }>(
    context,
    user,
    'POST',
    `/chronicles/${chronicleId}/characters`,
    { values: { name: 'Isadora Vex', clan: 'tremere' } }
  )

export const PRIORITIES = {
  attributes: ['physical', 'social', 'mental'],
  abilities: ['talents', 'skills', 'knowledges'],
}

// Todos os pontos básicos da V20, menos 1 de Vigor (os mesmos do Jest)
export const ALMOST: Record<string, unknown> = {
  strength: 4,
  dexterity: 3,
  stamina: 2,
  charisma: 3,
  manipulation: 3,
  appearance: 2,
  perception: 2,
  intelligence: 2,
  wits: 2,
  alertness: 3,
  athletics: 3,
  awareness: 3,
  brawl: 3,
  empathy: 1,
  animalKen: 3,
  crafts: 3,
  drive: 3,
  academics: 3,
  computer: 2,
  disciplines: [
    { id: 'd1', name: 'Taumaturgia', value: 2 },
    { id: 'd2', name: 'Auspícios', value: 1 },
  ],
  backgrounds: [
    { id: 'b1', name: 'Recursos', value: 3 },
    { id: 'b2', name: 'Mentor', value: 2 },
  ],
  conscience: 4,
  selfControl: 3,
  courage: 3,
}

/** Prioridades e pontos pela API, como o app gravaria (o servidor confere). */
export async function prepared(
  context: BrowserContext,
  user: User,
  id: string,
  values: Record<string, unknown>
) {
  await apiAs(context, user, 'PATCH', `/characters/${id}/creation`, {
    revision: 0,
    choices: { priorities: PRIORITIES },
  })
  await apiAs(context, user, 'POST', `/characters/${id}/events`, {
    clientBatchId: randomUUID(),
    events: Object.entries(values).map(([k, to]) => ({
      path: `values.${k}`,
      from: null,
      to,
    })),
  })
}

// A 390, as sub-abas ficam na faixa fixa e são as da seção que está no
// topo da tela (T-27): a ficha rola até a seção começar logo abaixo da
// faixa (não embaixo dela, que cobriria a primeira linha) antes de tocar a
// sub-aba. Um nome fora do mapa é uma aba da zona ("Pontos")
const GROUP_SECTION: Record<string, string> = {
  Físicos: 'attributes',
  Sociais: 'attributes',
  Mentais: 'attributes',
  Talentos: 'abilities',
  Perícias: 'abilities',
  Conhecimentos: 'abilities',
}
export const tab = async (page: Page, name: string) => {
  const section = GROUP_SECTION[name]
  if (section)
    await page.getByTestId(`section-${section}`).evaluate(el => {
      let scroller = el.parentElement
      while (scroller && scroller.scrollHeight <= scroller.clientHeight)
        scroller = scroller.parentElement
      if (!scroller) return
      const nav = document.querySelector('[data-testid="sheet-nav"]')
      const below = nav?.getBoundingClientRect().height ?? 0
      scroller.scrollTop +=
        el.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top -
        below
    })
  await page.getByRole('tab', { name, exact: true }).click()
}

export const plus = (page: Page, trait: string) =>
  page.getByRole('button', { name: `Aumentar ${trait}`, exact: true })
