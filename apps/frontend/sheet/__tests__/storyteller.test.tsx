import { fireEvent, screen, waitFor } from '@testing-library/react-native'
import { canWrite, type RoleName } from '@tms/sheet-core'
import { useFocusEffect, useRouter } from 'expo-router'
import { AccessibilityInfo } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import { modelOf, sheetFor, templateJson } from '../../test/fixtures'
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
    ['jogador', ['player']],
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
    fireEvent.press(screen.getByRole('button', { name: 'Histórico' }))
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
    fireEvent.press(screen.getByRole('button', { name: 'Histórico' }))
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
    fireEvent.press(screen.getByRole('button', { name: 'Histórico' }))
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
    await open(['player'])
    fireEvent.press(screen.getByRole('button', { name: 'Histórico' }))
    fireEvent.press(
      await screen.findByRole('button', { name: 'Carregar mais' })
    )
    expect(await screen.findByText('Nenhuma alteração ainda')).toBeTruthy()
  })

  it('vazio e erro com tentar de novo', async () => {
    calls.historyGet.mockResolvedValueOnce(fail(500, 'erro interno'))
    calls.historyGet.mockResolvedValue(ok({ items: [], next: null }))
    await open(['owner'])
    fireEvent.press(screen.getByRole('button', { name: 'Histórico' }))
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
