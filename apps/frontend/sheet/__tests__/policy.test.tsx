import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import { effectiveCreationConfig, type SheetData } from '@tms/sheet-core'
import { randomUUID } from 'expo-crypto'
import { useRouter } from 'expo-router'
import { AccessibilityInfo, Dimensions } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, ok } from '../../test/fake-api'
import { example, modelOf, templateJson } from '../../test/fixtures'
import { renderLive } from '../../test/live'
import { sheetsDismissed } from '../../test/queries'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import type { SheetLifecycle } from '../policy'
import { SheetScreen } from '../SheetScreen'
import { StatusMenuButton, statusActions } from '../storyteller/StatusMenu'

// v3, Etapa 6: a ficha usa a política só para desabilitar o que o servidor
// vai recusar, com o motivo no lugar; o narrador muda o estado pelo menu ⋯.

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning' },
}))
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
  getRandomValues: jest.fn(),
}))
jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

const vtm = modelOf('vtm-v20')
const helena = example('helena').sheet as unknown as SheetData
const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }
const DESKTOP = { width: 1280, height: 800, scale: 1, fontScale: 1 }

/** No celular, as ações do narrador ficam no "Mais opções" (T-11). */
const openNarratorMenu = async () => {
  fireEvent.press(screen.getByRole('button', { name: 'Mais opções' }))
  fireEvent.press(screen.getByRole('button', { name: /^Ações do narrador/ }))
  // As ações abrem depois que o menu sai da tela
  await sheetsDismissed()
}
const ID = '00000000-0000-4000-8000-00000000c001'

const lifecycle = (status: string, locked = false): SheetLifecycle => ({
  status,
  locked,
  member: true,
})

beforeEach(() => {
  jest
    .mocked(randomUUID)
    .mockReturnValue('00000000-0000-4000-8000-00000000b001')
  Dimensions.set({ window: PHONE, screen: PHONE })
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined)
  jest
    .mocked(useRouter)
    .mockReturnValue({ push: jest.fn(), replace: jest.fn() } as never)
})
afterEach(() => {
  Dimensions.set({ window: TABLET, screen: TABLET })
})

const serverPost = jest.fn()

describe('Evoluir depois da criação', () => {
  it('em active, o stepper de Força está desabilitado com o motivo, e Conceito não', async () => {
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'evolve',
        lifecycle: lifecycle('active'),
      },
      serverPost
    )
    const strength = screen.getByRole('adjustable', { name: 'Força' })
    expect(strength.props['aria-disabled']).toBe(true)
    expect(screen.getAllByText('Peça ao narrador.').length).toBeGreaterThan(0)
    // Texto continua editável: abre o editor
    fireEvent.press(screen.getByTestId('editor-concept'))
    expect(await screen.findByRole('header', { name: 'Conceito' })).toBeTruthy()
  })

  it('em active, a FdV permanente não muda, e a temporária muda', async () => {
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'evolve',
        lifecycle: lifecycle('active'),
      },
      serverPost
    )
    const permanent = screen.getByRole('adjustable', {
      name: 'Força de Vontade permanente',
    })
    const current = screen.getByRole('adjustable', {
      name: 'Força de Vontade atual',
    })
    expect(permanent.props['aria-disabled']).toBe(true)
    expect(current.props['aria-disabled']).toBe(false)
  })

  it('em creating, nada muda: o stepper de Força está livre', async () => {
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'evolve',
        lifecycle: lifecycle('creating'),
      },
      serverPost
    )
    const strength = screen.getByRole('adjustable', { name: 'Força' })
    expect(strength.props['aria-disabled']).toBe(false)
    expect(screen.queryByText('Peça ao narrador.')).toBeNull()
  })
})

describe('ficha travada', () => {
  it('o dock não abre o sheet de gasto, e o motivo é anunciado', async () => {
    await renderLive(
      {
        model: vtm,
        sheet: helena,
        mode: 'play',
        lifecycle: lifecycle('active', true),
      },
      serverPost
    )
    expect(screen.getByTestId('policy-banner')).toBeTruthy()
    // Sem o Editar: a política tirou
    expect(screen.queryByRole('radio', { name: 'Editar' })).toBeNull()
    fireEvent.press(screen.getByTestId('dock-blood'))
    expect(screen.queryByTestId('play-sheet')).toBeNull()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'O narrador travou a ficha.'
    )
  })
})

describe('as ações do narrador por estado', () => {
  const ids = (status: string, locked = false, system = 'vtm-v20') =>
    statusActions(modelOf(system), status, locked).map(a => a.label)

  it('só as válidas no estado', () => {
    expect(ids('creating')).toEqual([
      'Concluir criação',
      'Arquivar',
      'Marcar como Torpor',
    ])
    expect(ids('active')).toEqual(['Travar', 'Arquivar', 'Marcar como Torpor'])
    expect(ids('active', true)).toEqual([
      'Destravar',
      'Arquivar',
      'Marcar como Torpor',
    ])
    expect(ids('archived')).toEqual(['Reativar', 'Marcar como Torpor'])
    expect(ids('dead')).toEqual(['Reativar', 'Arquivar'])
    expect(ids('pending')).toEqual([])
  })

  it('sem statusLabels no template (CoC), o rótulo é "Fora de jogo"', () => {
    expect(ids('active', false, 'coc7e')).toEqual([
      'Travar',
      'Arquivar',
      'Marcar como Fora de jogo',
    ])
  })

  it('o fixture de D&D mostra o mesmo menu, com o rótulo de dead dele', () => {
    expect(ids('active', false, 'dnd5e-2014')).toEqual([
      'Travar',
      'Arquivar',
      'Marcar como Morto',
    ])
  })

  it('arquivar e dead pedem confirmação; o resto aplica no toque', () => {
    const asks = statusActions(vtm, 'active', false).filter(a => a.confirm)
    expect(asks.map(a => a.id)).toEqual(['archive', 'dead'])
  })

  it('concluir a criação também pede confirmação, com o texto do narrador (T-32)', () => {
    const asks = statusActions(vtm, 'creating', false).filter(a => a.confirm)
    expect(asks.map(a => a.id)).toEqual(['complete', 'archive', 'dead'])
    const [complete] = asks
    expect(complete).toMatchObject({
      title: 'Concluir criação?',
      confirmLabel: 'Concluir criação',
      done: 'Criação concluída. Subir um traço agora passa por você.',
    })
    expect(complete?.confirm).toContain('passa por você')
    expect(complete?.confirm).not.toContain('pelo narrador')
    // Com a aprovação ligada, o narrador conclui e aprova numa ação
    expect(statusActions(vtm, 'creating', false, true)[0]).toMatchObject({
      title: 'Concluir e aprovar?',
      confirmLabel: 'Concluir e aprovar',
    })
  })
})

describe('a tela da ficha com o estado', () => {
  async function signedIn() {
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    return session
  }

  const character = (
    roles: string[],
    status: string,
    lockedAt: string | null = null,
    // Os metadados da criação, quando o caso precisa deles (T-32)
    creation?: { readonly revision: number }
  ) =>
    ok({
      ...(creation && {
        creation: {
          mode: 'points',
          accounting: true,
          choices: {},
          config: {},
          effective: effectiveCreationConfig(vtm),
          returned: null,
          approval: false,
          ...creation,
        },
      }),
      id: ID,
      name: 'Helena Varga',
      chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
      owner: { id: 'u1', username: 'dona' },
      systemCode: 'vtm-v20',
      templateVersion: '1.0.0',
      sheetVersion: 3,
      roles,
      status,
      lockedAt,
      member: true,
      updatedAt: '2026-10-18T12:00:00Z',
      sheet: helena,
    })

  async function open(
    roles: string[],
    status: string,
    lockedAt?: string,
    creation?: { readonly revision: number }
  ) {
    calls.characterGet.mockResolvedValue(
      character(roles, status, lockedAt, creation)
    )
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    expect(await screen.findByLabelText('Destreza, 2 de 5')).toBeTruthy()
  }

  it.each(['NOT_MEMBER', 'SHEET_NOT_EDITABLE'])(
    'a recusa %s continua visível depois de a rebusca fechar os Dados',
    async code => {
      await open(['owner'], 'active')
      const next = character(['owner'], 'archived')
      next.data.member = code !== 'NOT_MEMBER'
      calls.characterGet.mockResolvedValue(next)
      calls.rollsPost.mockResolvedValue({
        data: null,
        error: { status: 403, value: { code } },
      })
      fireEvent.press(screen.getByRole('button', { name: 'Dados' }))
      fireEvent.press(screen.getByRole('button', { name: /^Atributo:/ }))
      fireEvent.changeText(screen.getByLabelText('Buscar atributo'), 'destreza')
      fireEvent.press(screen.getByRole('button', { name: 'Destreza, 2' }))
      fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
      await waitFor(() => expect(calls.rollsPost).toHaveBeenCalled())
      await waitFor(() => expect(calls.characterGet).toHaveBeenCalledTimes(2))
      await waitFor(() =>
        expect(screen.queryByRole('header', { name: 'Dados' })).toBeNull()
      )
      const message =
        code === 'NOT_MEMBER'
          ? 'Você saiu desta crônica: a ficha é só leitura. A rolagem não foi feita.'
          : 'A ficha está arquivada ou fora de jogo: só o narrador muda isto agora. A rolagem não foi feita.'
      expect(screen.getByText(message)).toBeTruthy()
    }
  )

  // U-01: "Peça ao narrador." leva a "Solicitar evolução" com o traço
  describe('o atalho para o pedido de evolução (U-01)', () => {
    const editar = async () => {
      fireEvent.press(await screen.findByRole('radio', { name: 'Editar' }))
    }

    it('ficha ativa, dona, Editar: "Solicitar evolução de Força" abre a Experiência com Força marcada e o resumo no rodapé', async () => {
      await open(['owner'], 'active')
      await editar()
      expect(screen.getAllByText('Peça ao narrador.').length).toBeGreaterThan(0)
      fireEvent.press(
        screen.getByRole('button', { name: 'Solicitar evolução de Força' })
      )
      const footer = await screen.findByTestId('xp-request-footer')
      expect(
        within(footer).getByTestId('xp-request-summary')
      ).toHaveTextContent(/^Força: \d → \d\. Custo \d+ XP/)
      const radio = screen.getByRole('radio', { name: /^Força, / })
      expect(radio.props.accessibilityState).toMatchObject({ checked: true })
    })

    it('a lista (Disciplinas) abre a busca pelo nome dela, sem traço marcado', async () => {
      await open(['owner'], 'active')
      await editar()
      fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
      fireEvent.press(
        screen.getByRole('button', {
          name: 'Solicitar evolução de Disciplinas',
        })
      )
      expect(await screen.findByLabelText('Buscar traço')).toHaveProp(
        'value',
        'Disciplinas'
      )
      expect(
        within(screen.getByTestId('xp-request-footer')).getByText(
          'Escolha um traço para ver o custo.'
        )
      ).toBeTruthy()
    })

    it('o narrador na ficha: sem atalho (o pedido é da dona)', async () => {
      await open(['storyteller'], 'active')
      expect(screen.queryByTestId('xp-shortcut')).toBeNull()
    })
  })

  it('o dono não tem o menu do narrador', async () => {
    await open(['owner'], 'active')
    fireEvent.press(screen.getByRole('button', { name: 'Mais opções' }))
    expect(
      screen.queryByRole('button', { name: /^Ações do narrador/ })
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeTruthy()
    expect(screen.queryByTestId('policy-banner')).toBeNull()
  })

  it('em criação, a dona também não tem o menu do narrador no "Mais opções"', async () => {
    calls.characterGet.mockResolvedValue(character(['owner'], 'creating'))
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    renderWithSession(<SheetScreen id={ID} />, await signedIn())
    // A ficha em criação da dona abre no Editar (T-05)
    fireEvent.press(await screen.findByRole('button', { name: 'Mais opções' }))
    expect(
      screen.queryByRole('button', { name: /^Ações do narrador/ })
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Histórico' })).toBeTruthy()
  })

  it('arquivada, o dono abre em Leitura, com o aviso e sem o seletor de modo', async () => {
    await open(['owner'], 'archived')
    expect(screen.getByTestId('policy-banner')).toBeTruthy()
    expect(screen.getByText('Ficha arquivada')).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Editar' })).toBeNull()
    expect(screen.queryByTestId('dock-blood')).toBeNull()
  })

  it('travada, o dono fica em Jogo: rola, mas não edita', async () => {
    await open(['owner'], 'active', '2026-10-18T12:00:00Z')
    expect(screen.getByText('O narrador travou a ficha')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dados' })).toBeTruthy()
    expect(screen.queryByRole('radio', { name: 'Editar' })).toBeNull()
  })

  // T-33: travada ou arquivada, o narrador continua escrevendo (o servidor
  // aceita), mas o seletor só aparece depois do "Editar como narrador"
  it.each([
    ['travada', 'active', '2026-10-18T12:00:00Z'],
    ['arquivada', 'archived', null],
  ] as const)(
    '%s, o narrador abre em Leitura, sem o seletor',
    async (_, status, locked) => {
      await open(['storyteller'], status, locked ?? undefined)
      expect(screen.queryByLabelText('Modo da ficha')).toBeNull()
      fireEvent.press(
        screen.getByRole('button', { name: 'Editar como narrador' })
      )
      expect(screen.getByRole('radio', { name: 'Jogo' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Editar' })).toBeTruthy()
    }
  )

  // T-32: o menu confirma, com o texto de quem lê, e manda a chave, a
  // revisão e a versão da ficha, como a barra
  it('o narrador conclui a criação pelo menu ⋯, depois de confirmar', async () => {
    calls.completePost.mockResolvedValue(
      ok({ status: 'active', lockedAt: null, creationCompletedAt: 'x' })
    )
    await open(['storyteller'], 'creating', undefined, { revision: 2 })
    await openNarratorMenu()
    fireEvent.press(screen.getByTestId('status-complete'))
    // A folha pergunta antes; nada vai ao servidor
    expect(screen.getByText('Concluir criação?')).toBeTruthy()
    expect(screen.getByTestId('completion-message')).toHaveTextContent(
      /passa por você/
    )
    expect(calls.completePost).not.toHaveBeenCalled()
    // "Voltar" volta à lista de ações
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByTestId('status-archive')).toBeTruthy()
    fireEvent.press(screen.getByTestId('status-complete'))
    await act(async () => {
      fireEvent.press(screen.getByTestId('status-complete-confirm'))
    })
    expect(calls.completePost).toHaveBeenCalledWith(ID, {
      revision: 2,
      sheetVersion: 3,
      clientCommandId: expect.any(String),
    })
    expect(
      await screen.findByText(
        'Criação concluída. Subir um traço agora passa por você.'
      )
    ).toBeTruthy()
  })

  it('com alterações não salvas, concluir pelo menu fica desabilitado', async () => {
    await open(['storyteller'], 'creating')
    // T-33: em Leitura, o narrador não tem seletor; a edição abre pelo botão,
    // e na criação livre ela é o Editar
    expect(screen.queryByRole('radio', { name: 'Editar' })).toBeNull()
    fireEvent.press(
      screen.getByRole('button', { name: 'Editar como narrador' })
    )
    expect(screen.getByRole('radio', { name: 'Editar' })).toBeChecked()
    for (const name of ['Força', 'Destreza'])
      fireEvent(
        screen.getByRole('adjustable', { name }),
        'accessibilityAction',
        { nativeEvent: { actionName: 'increment' } }
      )
    await openNarratorMenu()
    fireEvent.press(screen.getByTestId('status-complete'))
    expect(
      screen.getByText(
        'Você tem 2 alterações não salvas nesta ficha. Salve ou descarte antes de concluir.'
      )
    ).toBeTruthy()
    expect(screen.getByTestId('status-complete-confirm')).toBeDisabled()
    fireEvent.press(screen.getByTestId('status-complete-confirm'))
    expect(calls.completePost).not.toHaveBeenCalled()
  })

  // Achado do /code-review: a barra espera a fila; o menu também
  it('com lotes ainda na fila, concluir pelo menu espera sincronizar', async () => {
    const { session } = testSession(
      () => json(200, tokens()),
      memoryStore(true, 'r')
    )
    await session.restore()
    renderWithSession(
      <StatusMenuButton
        characterId={ID}
        chronicleId="c1"
        model={vtm}
        status="creating"
        locked={false}
        state={null}
        unsaved={0}
        queued={1}
      />,
      session
    )
    // O botão largo (no celular, o mesmo menu passa pelo "Mais opções")
    fireEvent.press(screen.getByRole('button', { name: /^Narrador/ }))
    fireEvent.press(screen.getByTestId('status-complete'))
    expect(
      screen.getByText(
        'Há alterações salvas ainda sendo enviadas. Espere sincronizar antes de concluir.'
      )
    ).toBeTruthy()
    expect(screen.getByTestId('status-complete-confirm')).toBeDisabled()
  })

  it('um 409 de versão diz que a ficha mudou e rebusca', async () => {
    calls.completePost.mockResolvedValue({
      data: null,
      error: {
        status: 409,
        value: { error: 'a ficha mudou', code: 'SHEET_VERSION_CONFLICT' },
      },
    })
    await open(['storyteller'], 'creating', undefined, { revision: 2 })
    const before = calls.characterGet.mock.calls.length
    await openNarratorMenu()
    fireEvent.press(screen.getByTestId('status-complete'))
    await act(async () => {
      fireEvent.press(screen.getByTestId('status-complete-confirm'))
    })
    expect(
      await screen.findByText(
        'A ficha mudou desde que você abriu. Confira e conclua de novo.'
      )
    ).toBeTruthy()
    await waitFor(() =>
      expect(calls.characterGet.mock.calls.length).toBeGreaterThan(before)
    )
  })

  it('no celular, as ações do narrador ficam no "Mais opções", com o estado no item', async () => {
    await open(['storyteller'], 'creating')
    // Um ⋯ só no cabeçalho, sem o gatilho largo, "Experiência" ou "Histórico"
    expect(screen.queryByText('Narrador')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Histórico' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Experiência' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Mais opções' }))
    expect(screen.getByRole('header', { name: 'Mais opções' })).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Ações do narrador · Em criação' })
    )
    // O menu fecha; as ações abrem depois que ele sai da tela
    expect(screen.queryByRole('header', { name: 'Mais opções' })).toBeNull()
    await sheetsDismissed()
    expect(
      screen.getByRole('header', { name: 'Ações do narrador' })
    ).toBeTruthy()
    expect(screen.getByTestId('status-complete')).toBeTruthy()
  })

  it('na tela larga, o menu do narrador diz de quem é e o estado da ficha', async () => {
    Dimensions.set({ window: DESKTOP, screen: DESKTOP })
    await open(['storyteller'], 'active', '2026-10-18T12:00:00Z')
    // O nome acessível começa pelo texto visível (WCAG 2.5.3, T-42)
    const trigger = screen.getByRole('button', { name: 'Narrador, Travada' })
    expect(trigger.props.accessibilityHint).toBe('Abre as ações do narrador')
    expect(screen.getByText('Narrador')).toBeTruthy()
    // "Travada" no gatilho e no selo sob o nome (P04-D)
    expect(within(trigger).getByText('Travada')).toBeTruthy()
    expect(screen.getByTestId('sheet-state')).toHaveTextContent('Travada')
    fireEvent.press(trigger)
    expect(screen.getByTestId('status-unlock')).toBeTruthy()
  })

  it('arquivar pede confirmação antes de chamar o servidor', async () => {
    calls.statusPost.mockResolvedValue(
      ok({ status: 'archived', lockedAt: null, creationCompletedAt: null })
    )
    await open(['storyteller'], 'active')
    await openNarratorMenu()
    fireEvent.press(screen.getByTestId('status-archive'))
    expect(calls.statusPost).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        'Arquivar a ficha? O jogador continua lendo, mas só você muda a ficha.'
      )
    ).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Arquivar' }))
    })
    expect(calls.statusPost).toHaveBeenCalledWith(ID, { status: 'archived' })
    await waitFor(() =>
      expect(screen.getByText('Ficha arquivada.')).toBeTruthy()
    )
  })
})
