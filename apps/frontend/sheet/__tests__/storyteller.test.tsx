import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import {
  canWrite,
  effectiveCreationConfig,
  type RoleName,
} from '@tms/sheet-core'
import { useFocusEffect, useRouter } from 'expo-router'
import { AccessibilityInfo } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import { modelOf, sheetFor, templateJson } from '../../test/fixtures'
import { sheetsDismissed } from '../../test/queries'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import { SheetScreen } from '../SheetScreen'
import { storytellerOnlyText } from '../storyteller/StorytellerBar'
import type { QueuedBatch } from '../sync/outbox'
import type { PostOutcome } from '../sync/sender'

// Etapa 19 na ficha: "Editar como narrador", as Notas do Narrador editáveis só
// por ele e o "Histórico de alterações".

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const ID = '00000000-0000-4000-8000-00000000c001'

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  } as never)
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation()
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

const character = (roles: RoleName[]) =>
  ok({
    id: ID,
    name: 'Helena Varga',
    chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
    owner: { id: 'u1', username: 'dona' },
    systemCode: 'vtm-v20',
    templateVersion: '1.0.0',
    sheetVersion: 3,
    roles,
    updatedAt: '2026-10-18T12:00:00Z',
    sheet: sheetFor('helena', roles).sheet,
  })

const item = (
  id: string,
  byRole: 'owner' | 'storyteller',
  changes: { label: string; change: string }[]
) => ({
  id,
  at: new Date().toISOString(),
  by: { username: byRole === 'owner' ? 'dona' : 'ana' },
  byRole,
  sheetVersion: 1,
  changes,
})

async function open(roles: RoleName[], post?: () => Promise<PostOutcome>) {
  calls.characterGet.mockResolvedValue(character(roles))
  renderWithSession(<SheetScreen id={ID} />, await signedIn(), { post })
  await screen.findByLabelText(/^Destreza, 2 de 5/)
}

/**
 * O Histórico pelo "Mais opções" (T-11): sem Dimensions, o mock do RN fica em
 * 750 (medium), abaixo dos 900 dos botões no cabeçalho.
 */
const openHistory = async () => {
  fireEvent.press(screen.getByRole('button', { name: 'Mais opções' }))
  fireEvent.press(screen.getByRole('button', { name: 'Histórico' }))
  await sheetsDismissed()
}

describe('Editar como narrador', () => {
  it('a ficha do jogador abre em Leitura; editar é explícito e avisado', async () => {
    await open(['storyteller'])
    expect(screen.getByText('Ficha de dona.')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: 'Editar Notas do Narrador' })
    ).toBeNull()
    fireEvent.press(
      screen.getByRole('button', { name: 'Editar como narrador' })
    )
    expect(
      screen.getByText('As alterações ficam assinadas no histórico.')
    ).toBeTruthy()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Editando como narrador. As alterações ficam assinadas no histórico.'
    )
    fireEvent.press(screen.getByRole('button', { name: 'Voltar à leitura' }))
    expect(screen.getByText('Ficha de dona.')).toBeTruthy()
  })

  it('o narrador edita as Notas do Narrador; o lote sai com o from atual', async () => {
    const sent: QueuedBatch[] = []
    const post = jest.fn(async (_: string, b: QueuedBatch) => {
      sent.push(b)
      return { status: 200, body: null }
    })
    await open(['storyteller'], post as never)
    fireEvent.press(
      screen.getByRole('button', { name: 'Editar como narrador' })
    )
    fireEvent.press(
      screen.getByRole('button', { name: 'Editar Notas do Narrador' })
    )
    const field = screen.getByLabelText('Notas do Narrador')
    expect(field.props.value).toBe(
      sheetFor('helena', ['storyteller']).sheet.values.storytellerNotes
    )
    fireEvent.changeText(field, 'O Regente cobrou o favor.')
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.events).toEqual([
      {
        path: 'values.storytellerNotes',
        from: sheetFor('helena', ['storyteller']).sheet.values.storytellerNotes,
        to: 'O Regente cobrou o favor.',
      },
    ])
    // O aviso com Desfazer da Etapa 16
    expect(screen.getByText('Notas do Narrador')).toBeTruthy()
  })

  it('cancelar, ou salvar sem mudar, não manda nada; apagar volta ao padrão', async () => {
    const sent: QueuedBatch[] = []
    const post = jest.fn(async (_: string, b: QueuedBatch) => {
      sent.push(b)
      return { status: 200, body: null }
    })
    await open(['storyteller'], post as never)
    fireEvent.press(
      screen.getByRole('button', { name: 'Editar como narrador' })
    )
    const edit = () =>
      fireEvent.press(
        screen.getByRole('button', { name: 'Editar Notas do Narrador' })
      )
    edit()
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    edit()
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.queryByLabelText('Notas do Narrador')).toBeNull()
    edit()
    fireEvent.changeText(screen.getByLabelText('Notas do Narrador'), '')
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.events[0]?.to).toBeNull()
  })

  it.each([
    ['dono', ['owner']],
    ['narrador dono da própria ficha', ['owner', 'storyteller']],
  ] as const)('%s: sem a barra do narrador', async (_, roles) => {
    await open([...roles])
    expect(
      screen.queryByRole('button', { name: 'Editar como narrador' })
    ).toBeNull()
  })

  it('os textos só do narrador vêm das permissões do template', () => {
    expect(storytellerOnlyText(modelOf('vtm-v20')).map(f => f.id)).toEqual([
      'storytellerNotes',
    ])
    for (const system of ['dnd5e-2014', 'coc7e', 'fate-core', 'mta-m20']) {
      const model = modelOf(system)
      for (const f of storytellerOnlyText(model)) {
        expect(canWrite(model, f.id, ['storyteller'])).toBe(true)
        expect(canWrite(model, f.id, ['owner'])).toBe(false)
      }
    }
  })
})

describe('Histórico de alterações', () => {
  it('quem, quando, o que mudou e "(narrador)"', async () => {
    calls.historyGet.mockResolvedValue(
      ok({
        items: [
          item('b2', 'storyteller', [
            { label: 'Vitalidade', change: '+1 letal' },
          ]),
          item('b1', 'owner', [
            { label: 'Sangue', change: '9 → 8' },
            { label: 'Notas', change: 'atualizado' },
          ]),
        ],
        next: null,
      })
    )
    await open(['owner'])
    await openHistory()
    expect(
      await screen.findByLabelText(
        /^Vitalidade: \+1 letal\. às \d\d:\d\d · ana \(narrador\)$/
      )
    ).toBeTruthy()
    expect(
      screen.getByLabelText(
        /^Sangue: 9 → 8; Notas: atualizado\. às \d\d:\d\d · dona$/
      )
    ).toBeTruthy()
    expect(calls.historyGet).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ query: {} })
    )
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull()
  })

  // T-80: a conclusão aparece com quem concluiu, sem "Desfazer"
  it('"Criação concluída" com quem concluiu e sem "Desfazer"', async () => {
    calls.historyGet.mockResolvedValue(
      ok({
        items: [
          {
            ...item('a1', 'storyteller', []),
            event: 'creation.completed',
            reversible: false,
            sheetVersion: null,
            operationId: null,
          },
          item('b1', 'owner', [{ label: 'Força', change: '2 → 3' }]),
        ],
        next: null,
      })
    )
    await open(['storyteller'])
    await openHistory()
    expect(
      await screen.findByLabelText(
        /^Criação concluída\. às \d\d:\d\d · ana \(narrador\)$/
      )
    ).toBeTruthy()
    expect(screen.getByText('Criação concluída')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
  })

  // P04-D (R-12): os outros passos do ciclo, sem "Desfazer" e sem o motivo
  it('enviar, devolver, pedir ajuste e avisar aparecem como passos', async () => {
    const stepOf = (
      id: string,
      byRole: 'owner' | 'storyteller',
      event: string
    ) => ({
      ...item(id, byRole, []),
      event,
      reversible: false,
      sheetVersion: null,
      operationId: null,
    })
    calls.historyGet.mockResolvedValue(
      ok({
        items: [
          stepOf('a4', 'owner', 'creation.ready'),
          stepOf('a3', 'storyteller', 'creation.adjust'),
          stepOf('a2', 'storyteller', 'creation.returned'),
          stepOf('a1', 'owner', 'creation.submitted'),
          // Um passo que esta versão não conhece: só a data e o autor
          stepOf('a0', 'owner', 'creation.reopened'),
        ],
        next: null,
      })
    )
    await open(['owner'])
    await openHistory()
    expect(
      await screen.findByLabelText(
        /^Avisou que terminou\. às \d\d:\d\d · dona$/
      )
    ).toBeTruthy()
    expect(
      screen.getByLabelText(/^Ajuste pedido\. às \d\d:\d\d · ana \(narrador\)$/)
    ).toBeTruthy()
    expect(screen.getByText('Devolvida para correção')).toBeTruthy()
    expect(screen.getByText('Enviada para aprovação')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
  })

  it('quem excluiu a conta aparece como "Conta excluída"', async () => {
    calls.historyGet.mockResolvedValue(
      ok({
        items: [
          {
            ...item('b3', 'storyteller', [
              { label: 'Vitalidade', change: '+1 letal' },
            ]),
            by: null,
          },
        ],
        next: null,
      })
    )
    await open(['owner'])
    await openHistory()
    expect(
      await screen.findByLabelText(
        /^Vitalidade: \+1 letal\. às \d\d:\d\d · Conta excluída \(narrador\)$/
      )
    ).toBeTruthy()
  })

  it('"Carregar mais" segue o cursor até o fim', async () => {
    calls.historyGet.mockImplementation(
      async (_id: string, opts: { query: { before?: string } }) =>
        opts.query.before === 'cursor-1'
          ? ok({
              items: [
                item('b1', 'owner', [{ label: 'Força', change: '2 → 3' }]),
              ],
              next: null,
            })
          : ok({
              items: [
                item('b2', 'owner', [{ label: 'Sangue', change: '9 → 8' }]),
              ],
              next: 'cursor-1',
            })
    )
    await open(['owner'])
    await openHistory()
    fireEvent.press(
      await screen.findByRole('button', { name: 'Carregar mais' })
    )
    expect(await screen.findByText('Força: 2 → 3')).toBeTruthy()
    expect(screen.getByText('Sangue: 9 → 8')).toBeTruthy()
    expect(calls.historyGet).toHaveBeenLastCalledWith(
      ID,
      expect.objectContaining({ query: { before: 'cursor-1' } })
    )
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull()
  })

  it('página só com lotes que o papel não lê: ainda dá para carregar mais', async () => {
    calls.historyGet.mockResolvedValueOnce(ok({ items: [], next: 'c' }))
    calls.historyGet.mockResolvedValue(ok({ items: [], next: null }))
    await open(['owner'])
    await openHistory()
    fireEvent.press(
      await screen.findByRole('button', { name: 'Carregar mais' })
    )
    expect(await screen.findByText('Nenhuma alteração ainda')).toBeTruthy()
  })

  it('vazio e erro com tentar de novo', async () => {
    calls.historyGet.mockResolvedValueOnce(fail(500, 'erro interno'))
    calls.historyGet.mockResolvedValue(ok({ items: [], next: null }))
    await open(['owner'])
    await openHistory()
    fireEvent.press(
      await screen.findByRole('button', { name: 'Tentar de novo' })
    )
    expect(await screen.findByText('Nenhuma alteração ainda')).toBeTruthy()
    fireEvent.press(
      screen.getAllByRole('button', { name: 'Fechar' })[0] as never
    )
    expect(screen.queryByText('Nenhuma alteração ainda')).toBeNull()
  })

  it('o histórico só é pedido quando aberto', async () => {
    await open(['owner'])
    expect(calls.historyGet).not.toHaveBeenCalled()
  })
})

describe('sem tempo real', () => {
  it('voltar para a ficha rebusca do servidor', async () => {
    const focus: (() => void)[] = []
    jest.mocked(useFocusEffect).mockImplementation(cb => {
      focus.push(cb as () => void)
    })
    await open(['storyteller'])
    const before = calls.characterGet.mock.calls.length
    focus.at(-1)?.()
    await waitFor(() =>
      expect(calls.characterGet.mock.calls.length).toBe(before + 1)
    )
  })
})

// T-18 (P05-C): a sobra de bônus também na confirmação do narrador, que
// fica no cabeçalho, fora da ficha (o número chega pelo onDraftState). Só com
// a conta fechada: com básicos faltando, o servidor recusa concluir
describe('sobra de bônus na confirmação do narrador (T-18)', () => {
  // Todos os pontos básicos da V20, sem bônus gasto
  const COMPLETE = {
    name: 'Nova',
    clan: 'tremere',
    strength: 4,
    dexterity: 3,
    stamina: 3,
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
  const creating = (values: Record<string, unknown> | null, points = true) =>
    ok({
      ...character(['storyteller']).data,
      status: 'creating',
      lockedAt: null,
      member: true,
      sheet: {
        values: values ?? { name: 'Nova', clan: 'tremere' },
        specialties: {},
      },
      ...(points
        ? {
            creation: {
              revision: 1,
              mode: 'points',
              accounting: true,
              choices: {
                priorities: {
                  attributes: ['physical', 'social', 'mental'],
                  abilities: ['talents', 'skills', 'knowledges'],
                },
              },
              config: {},
              effective: effectiveCreationConfig(modelOf('vtm-v20')),
              returned: null,
              approval: false,
            },
          }
        : {}),
    })
  const confirm = async () => {
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    // Abaixo de 900, as ações do narrador ficam no "Mais opções" (T-11)
    fireEvent.press(await screen.findByRole('button', { name: 'Mais opções' }))
    fireEvent.press(screen.getByRole('button', { name: /^Ações do narrador/ }))
    await sheetsDismissed()
    fireEvent.press(screen.getByTestId('status-complete'))
    expect(screen.getByTestId('completion-message')).toHaveTextContent(
      /passa por você/
    )
  }

  it('"Concluir criação" pelo menu traz a mesma linha da barra', async () => {
    calls.characterGet.mockResolvedValue(creating(COMPLETE))
    await confirm()
    expect(
      await screen.findByText('Sobram 15 pontos de bônus. Eles não viram XP.')
    ).toBeTruthy()
  })

  it('com básicos faltando, nenhuma linha de bônus (achado do /code-review)', async () => {
    calls.characterGet.mockResolvedValue(creating(null))
    await confirm()
    expect(screen.queryByText(/pontos? de bônus/)).toBeNull()
  })

  it('sem a conta da criação, nenhuma linha de bônus', async () => {
    calls.characterGet.mockResolvedValue(creating(COMPLETE, false))
    await confirm()
    expect(screen.queryByText(/pontos? de bônus/)).toBeNull()
  })
})

// P04-D (D-04, R-14): o narrador pede ajuste, com motivo, numa ficha em
// criação, pelo mesmo menu; o servidor confere papel e estado
describe('pedir ajuste', () => {
  const creating = (over: Record<string, unknown> = {}) =>
    ok({
      ...character(['storyteller']).data,
      status: 'creating',
      lockedAt: null,
      member: true,
      creation: {
        revision: 2,
        mode: 'free',
        accounting: true,
        choices: {},
        config: {},
        effective: effectiveCreationConfig(modelOf('vtm-v20')),
        returned: null,
        adjust: null,
        ready: null,
        approval: false,
      },
      ...over,
    })
  const openMenu = async () => {
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    fireEvent.press(await screen.findByRole('button', { name: 'Mais opções' }))
    fireEvent.press(screen.getByRole('button', { name: /^Ações do narrador/ }))
    await sheetsDismissed()
  }

  it('aparece em creating, no PC de outra pessoa; o motivo é obrigatório', async () => {
    calls.characterGet.mockResolvedValue(creating())
    calls.creationAdjustPost.mockResolvedValue(ok({ revision: 3 }))
    await openMenu()
    const actions = screen
      .getAllByRole('button')
      .map(b => b.props.testID)
      .filter((id): id is string => /^status-/.test(String(id)))
    expect(actions).toEqual([
      'status-complete',
      'status-adjust',
      'status-archive',
      'status-dead',
    ])
    fireEvent.press(screen.getByTestId('status-adjust'))
    expect(screen.getByRole('header', { name: 'Pedir ajuste' })).toBeTruthy()
    expect(
      screen.getByText(
        'O jogador vê o motivo na ficha, como numa devolução. A ficha continua em criação.'
      )
    ).toBeTruthy()
    const field = screen.getByTestId('status-adjust-reason')
    expect(field.props.maxLength).toBe(500)
    expect(screen.getByTestId('status-adjust-confirm')).toBeDisabled()
    fireEvent.changeText(field, '   ')
    expect(screen.getByTestId('status-adjust-confirm')).toBeDisabled()
    fireEvent.changeText(field, '  Refaça os Antecedentes ')
    fireEvent.press(screen.getByTestId('status-adjust-confirm'))
    await waitFor(() =>
      expect(calls.creationAdjustPost).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({
          reason: 'Refaça os Antecedentes',
          revision: 2,
        })
      )
    )
    expect(
      await screen.findByText('Ajuste pedido. O jogador vê o motivo na ficha.')
    ).toBeTruthy()
  })

  it('o "enviar" do teclado manda o texto do evento (e0a4078)', async () => {
    calls.characterGet.mockResolvedValue(creating())
    calls.creationAdjustPost.mockResolvedValue(ok({ revision: 3 }))
    await openMenu()
    fireEvent.press(screen.getByTestId('status-adjust'))
    const field = screen.getByTestId('status-adjust-reason')
    fireEvent.changeText(field, 'Refaça')
    fireEvent(field, 'submitEditing', {
      nativeEvent: { text: 'Refaça os Antecedentes' },
    })
    await waitFor(() =>
      expect(calls.creationAdjustPost).toHaveBeenCalledWith(
        ID,
        expect.objectContaining({ reason: 'Refaça os Antecedentes' })
      )
    )
  })

  it('422 fica na folha, com o texto; 409 avisa e rebusca', async () => {
    calls.characterGet.mockResolvedValue(creating())
    calls.creationAdjustPost.mockResolvedValue(fail(422, 'motivo inválido'))
    await openMenu()
    fireEvent.press(screen.getByTestId('status-adjust'))
    fireEvent.changeText(screen.getByTestId('status-adjust-reason'), 'x > y')
    fireEvent.press(screen.getByTestId('status-adjust-confirm'))
    expect(
      await screen.findByText(
        'Escreva o que precisa ser ajustado (até 500 caracteres, sem < nem >).'
      )
    ).toBeTruthy()
    expect(screen.getByTestId('status-adjust-reason').props.value).toBe('x > y')
    calls.creationAdjustPost.mockResolvedValue(
      fail(409, 'a configuração da criação mudou')
    )
    const before = calls.characterGet.mock.calls.length
    fireEvent.press(screen.getByTestId('status-adjust-confirm'))
    expect(
      await screen.findByText(
        'A ficha mudou desde que você abriu. Confira e peça de novo.'
      )
    ).toBeTruthy()
    await waitFor(() =>
      expect(calls.characterGet.mock.calls.length).toBeGreaterThan(before)
    )
  })

  it('o 409 com motivo próprio diz por que o pedido não vale', async () => {
    calls.characterGet.mockResolvedValue(creating())
    calls.creationAdjustPost.mockResolvedValue({
      data: null,
      error: {
        status: 409,
        value: {
          error: 'só uma ficha em criação recebe pedido de ajuste',
          code: 'CREATION_NOT_CREATING',
        },
      },
    })
    await openMenu()
    fireEvent.press(screen.getByTestId('status-adjust'))
    fireEvent.changeText(screen.getByTestId('status-adjust-reason'), 'Refaça')
    fireEvent.press(screen.getByTestId('status-adjust-confirm'))
    expect(
      await screen.findByText(
        'A ficha não está mais em criação: o pedido de ajuste não vale aqui.'
      )
    ).toBeTruthy()
  })

  it.each([
    [
      'NPC',
      {
        projection: 'full',
        kind: 'npc',
        visibility: 'hidden',
        visibilityRevision: 0,
        presentationRevision: 0,
        identity: {
          name: 'Sentinela',
          chip: '',
          subtitle: null,
          portraitUrl: null,
        },
      },
      'creating',
    ],
    [
      'ficha do próprio narrador',
      { roles: ['owner', 'storyteller'] },
      'creating',
    ],
    ['pending', {}, 'pending'],
    ['ativa', {}, 'active'],
  ])('não aparece: %s', async (_, over, status) => {
    calls.characterGet.mockResolvedValue(creating({ ...over, status }))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    fireEvent.press(await screen.findByRole('button', { name: 'Mais opções' }))
    // Em pending, o menu do narrador não tem ação (aprovar e devolver ficam
    // no painel)
    const narrator = screen.queryByRole('button', {
      name: /^Ações do narrador/,
    })
    if (narrator) {
      fireEvent.press(narrator)
      await sheetsDismissed()
      expect(screen.getByTestId('status-archive')).toBeTruthy()
    }
    expect(screen.queryByTestId('status-adjust')).toBeNull()
  })
})
