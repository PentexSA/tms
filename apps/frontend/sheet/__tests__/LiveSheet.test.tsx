import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { ResolvedResource } from '@tms/sheet-core'
import { Pressable, Text } from '@tms/ui'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'

import * as apiModule from '../../lib/api'
import { type createFakeApi, ok } from '../../test/fake-api'
import { example, sheetFor, templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import { SheetProvider, useResolvedField } from '../context'
import { SheetScreen } from '../SheetScreen'
import { SheetView } from '../SheetView'
import { createSheetStore, type SheetStore } from '../store/sheetStore'
import { createPersistedDraftStore, type DraftStore } from '../sync/draftStore'
import { createMemoryStorage } from '../sync/kv'
import { createMemoryOutbox, type QueuedBatch } from '../sync/outbox'
import { useSync } from '../sync/SyncProvider'
import type { PostOutcome } from '../sync/sender'
import { useCommit } from '../useCommit'

// Etapa 16 na tela: o toque aplica na hora, o aviso tem Desfazer, o conflito
// aparece com "Reaplicar" e a ficha rebuscada entra no store.

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const ID = '00000000-0000-4000-8000-00000000c001'
const { model, sheet } = sheetFor('helena', ['owner'])

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  } as never)
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

function SpendBlood() {
  const commit = useCommit()
  const blood = useResolvedField('blood') as ResolvedResource
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Gastar 1 Sangue"
      onPress={() =>
        commit(
          [
            {
              path: 'values.blood',
              from: { current: blood.current },
              to: { current: blood.current - 1 },
            },
          ],
          'Sangue −1'
        )
      }
    >
      <Text>Gastar</Text>
    </Pressable>
  )
}

function Live({ onStore }: { readonly onStore?: (s: SheetStore) => void }) {
  const sync = useSync()
  const [store] = useState(() =>
    createSheetStore({
      characterId: ID,
      model,
      sheet,
      sheetVersion: 3,
      roles: ['owner'],
      sync,
    })
  )
  useEffect(() => sync.register(ID, store), [sync, store])
  onStore?.(store)
  return (
    <SheetProvider store={store}>
      <SpendBlood />
      <SheetView store={store} />
    </SheetProvider>
  )
}

const withBlood = (current: number) => ({
  ...sheet,
  values: { ...sheet.values, blood: { current } },
})

describe('commit pela tela', () => {
  it('aplica na hora; o aviso tem Desfazer, que manda o lote inverso', async () => {
    const sent: QueuedBatch[] = []
    const post = jest.fn(
      async (_: string, b: QueuedBatch): Promise<PostOutcome> => {
        sent.push(b)
        const [event] = b.events
        const to = (event?.to as { current: number } | undefined)?.current ?? 0
        return {
          status: 200,
          body: { sheetVersion: 3 + sent.length, sheet: withBlood(to) },
        }
      }
    )
    renderWithSession(<Live />, await signedIn(), { post })
    expect(screen.getByLabelText(/^Pontos de Sangue, 9 de/)).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Gastar 1 Sangue' }))
    expect(screen.getByLabelText(/^Pontos de Sangue, 8 de/)).toBeTruthy()
    expect(screen.getByText('Sangue −1')).toBeTruthy()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))

    fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
    expect(screen.getByLabelText(/^Pontos de Sangue, 9 de/)).toBeTruthy()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
    expect(sent[1]?.events).toEqual([
      { path: 'values.blood', from: { current: 8 }, to: { current: 9 } },
    ])
    expect(sent[1]?.label).toBe('Desfeito: Sangue −1')
  })

  it('Desfazer depois de o valor mudar em outro lugar avisa', async () => {
    const post = jest.fn(
      async (): Promise<PostOutcome> => ({ status: 0, body: null })
    )
    let store: SheetStore | undefined
    renderWithSession(
      <Live
        onStore={s => {
          store = s
        }}
      />,
      await signedIn(),
      { post }
    )
    fireEvent.press(screen.getByRole('button', { name: 'Gastar 1 Sangue' }))
    // A narradora deixou o Sangue em 5 antes de o lote chegar
    act(() => {
      store?.getState().received(withBlood(5), 4)
    })
    fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
    expect(
      screen.getByText('Não dá para desfazer: o valor mudou depois.')
    ).toBeTruthy()
    expect(screen.getByLabelText(/^Pontos de Sangue, 5 de/)).toBeTruthy()
  })

  it('lote inválido não sai do aparelho e a pessoa é avisada', async () => {
    const post = jest.fn()
    let store: SheetStore | undefined
    renderWithSession(
      <Live
        onStore={s => {
          store = s
        }}
      />,
      await signedIn(),
      { post }
    )
    act(() => {
      store?.getState().received(withBlood(0), 4)
    })
    fireEvent.press(screen.getByRole('button', { name: 'Gastar 1 Sangue' }))
    expect(screen.getByText(/^Não foi possível:/)).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })
})

describe('conflito (409)', () => {
  it('mostra o aviso com o rótulo do campo e reaplica sobre o valor de agora', async () => {
    const sent: QueuedBatch[] = []
    const post = jest.fn(
      async (_: string, b: QueuedBatch): Promise<PostOutcome> => {
        sent.push(b)
        return sent.length === 1
          ? { status: 409, body: { current: {}, sheetVersion: 4 } }
          : { status: 200, body: { sheetVersion: 5, sheet: withBlood(8) } }
      }
    )
    let store: SheetStore | undefined
    renderWithSession(
      <Live
        onStore={s => {
          store = s
        }}
      />,
      await signedIn(),
      { post }
    )
    fireEvent.press(screen.getByRole('button', { name: 'Gastar 1 Sangue' }))
    expect(await screen.findByText('A ficha mudou em outro lugar')).toBeTruthy()
    expect(
      screen.getByText(
        /^Pontos de Sangue mudou antes de a sua alteração chegar/
      )
    ).toBeTruthy()
    // A ficha rebuscada: a narradora deixou o Sangue em 3
    act(() => {
      store?.getState().received(withBlood(3), 4)
    })
    expect(screen.getByLabelText(/^Pontos de Sangue, 3 de/)).toBeTruthy()
    // T-31: a faixa não reaplica às cegas; "Revisar" mostra os dois valores
    expect(screen.queryByRole('button', { name: 'Reaplicar' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Revisar' }))
    expect(
      screen.getByLabelText(
        'Em jogo › Pontos de Sangue. Seu valor: atual 8. Valor atual: atual 3.'
      )
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Reaplicar tudo' }))
    expect(screen.queryByText('A ficha mudou em outro lugar')).toBeNull()
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]?.events).toEqual([
      { path: 'values.blood', from: { current: 3 }, to: { current: 8 } },
    ])
  })

  it('"Manter como está" fecha o aviso sem mandar nada', async () => {
    const post = jest.fn(
      async (): Promise<PostOutcome> => ({ status: 409, body: {} })
    )
    renderWithSession(<Live />, await signedIn(), { post })
    fireEvent.press(screen.getByRole('button', { name: 'Gastar 1 Sangue' }))
    fireEvent.press(await screen.findByRole('button', { name: 'Revisar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Manter como está' }))
    expect(screen.queryByText('A ficha mudou em outro lugar')).toBeNull()
    expect(post).toHaveBeenCalledTimes(1)
  })
})

describe('SheetScreen com o store', () => {
  const character = (s = example('helena').sheet, sheetVersion = 3) =>
    ok({
      id: ID,
      name: 'Helena Varga',
      chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
      owner: { id: 'u1', username: 'dona' },
      systemCode: 'vtm-v20',
      templateVersion: '1.0.0',
      sheetVersion,
      roles: ['owner'],
      updatedAt: '2026-10-18T12:00:00Z',
      sheet: s,
    })

  it('a ficha rebuscada (versão nova) aparece', async () => {
    calls.characterGet.mockResolvedValue(character())
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
    const { queryClient } = renderWithSession(
      <SheetScreen id={ID} />,
      await signedIn()
    )
    expect(await screen.findByLabelText(/^Pontos de Sangue, 9 de/)).toBeTruthy()
    const helena = example('helena').sheet
    calls.characterGet.mockResolvedValue(
      character(
        { ...helena, values: { ...helena.values, blood: { current: 2 } } },
        4
      )
    )
    await act(() => queryClient.invalidateQueries())
    expect(await screen.findByLabelText(/^Pontos de Sangue, 2 de/)).toBeTruthy()
  })
})

// T-03: o rascunho de Criação/Editar só vivia na memória; fechar o app, uma
// queda ou o F5 apagavam tudo, sem aviso nem recuperação
describe('rascunho guardado no aparelho', () => {
  const character = (extra: Record<string, unknown> = {}) =>
    ok({
      id: ID,
      name: 'Helena Varga',
      chronicle: { id: 'c1', name: 'Crônica da Liberdade' },
      owner: { id: 'u1', username: 'dona' },
      systemCode: 'vtm-v20',
      templateVersion: '1.0.0',
      sheetVersion: 3,
      roles: ['owner'],
      // Em criação (livre): Editar muda os traços direto; ativa, subir um
      // traço passa pelo narrador
      status: 'creating',
      lockedAt: null,
      member: true,
      updatedAt: '2026-10-18T12:00:00Z',
      sheet: example('helena').sheet,
      ...extra,
    })
  const increment = (name: string) =>
    fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })
  const saved = async (drafts: DraftStore) =>
    (await drafts.read(ID))?.edits.length ?? 0

  beforeEach(() => {
    calls.characterGet.mockResolvedValue(character())
    calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  })

  /** Abre a ficha em Editar e muda Força, Destreza e Raciocínio. */
  async function editThree(drafts: DraftStore, options = {}) {
    const view = renderWithSession(
      <SheetScreen id={ID} initialMode="evolve" />,
      await signedIn(),
      { drafts, ...options }
    )
    expect(await screen.findByText('Editando · 0 alterações')).toBeTruthy()
    increment('Força')
    increment('Destreza')
    increment('Raciocínio')
    expect(screen.getByText('Editando · 3 alterações')).toBeTruthy()
    // T-17: o cabeçalho diz a verdade, não "Salvo"
    expect(
      screen.getByLabelText('Sincronização: 3 alterações não salvas')
    ).toBeTruthy()
    expect(screen.queryByLabelText('Sincronização: Salvo')).toBeNull()
    await waitFor(async () => expect(await saved(drafts)).toBe(3))
    return view
  }

  /** O "kill": um store novo, a mesma ficha, o mesmo aparelho. */
  async function reopen(drafts: DraftStore) {
    renderWithSession(<SheetScreen id={ID} />, await signedIn(), { drafts })
    return screen.findByText(
      /^Você tem 3 alterações não salvas nesta ficha, de \d\d\/\d\d às \d\d:\d\d\. Recuperar\?$/
    )
  }

  it('fechar e reabrir oferece as 3; "Recuperar" volta a Editar com elas', async () => {
    const drafts = createPersistedDraftStore(createMemoryStorage())
    const first = await editThree(drafts)
    first.unmount()
    expect(await reopen(drafts)).toBeTruthy()
    // Pausado até decidir: a abertura em Jogo não apaga o registro
    expect(await saved(drafts)).toBe(3)
    fireEvent.press(screen.getByRole('button', { name: 'Recuperar' }))
    expect(screen.getByText('Editando · 3 alterações')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Editar' })).toBeChecked()
    expect(
      screen.getByRole('adjustable', { name: 'Força' })
    ).toHaveAccessibilityValue({ now: 3 })
    expect(await screen.findByText('3 alterações recuperadas.')).toBeTruthy()
  })

  it('"Descartar" apaga o registro', async () => {
    const drafts = createPersistedDraftStore(createMemoryStorage())
    ;(await editThree(drafts)).unmount()
    await reopen(drafts)
    fireEvent.press(screen.getByRole('button', { name: 'Descartar' }))
    await waitFor(async () => expect(await saved(drafts)).toBe(0))
    expect(screen.queryByText(/alterações não salvas nesta ficha/)).toBeNull()
  })

  it('fechar a oferta mantém o registro; entrar em Editar oferece de novo', async () => {
    const drafts = createPersistedDraftStore(createMemoryStorage())
    ;(await editThree(drafts)).unmount()
    await reopen(drafts)
    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText(/alterações não salvas nesta ficha/)).toBeNull()
    expect(screen.getByRole('radio', { name: 'Jogo' })).toBeChecked()
    expect(await saved(drafts)).toBe(3)
    fireEvent.press(screen.getByRole('radio', { name: 'Editar' }))
    expect(
      await screen.findByText(/^Você tem 3 alterações não salvas/)
    ).toBeTruthy()
    expect(await saved(drafts)).toBe(3)
  })

  it('"Salvar" só apaga o registro depois de o lote entrar no outbox', async () => {
    const drafts = createPersistedDraftStore(createMemoryStorage())
    const memory = createMemoryOutbox()
    let release: () => void = () => undefined
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const outbox = {
      ...memory,
      enqueue: async (id: string, batch: QueuedBatch) => {
        await gate
        return memory.enqueue(id, batch)
      },
    }
    const post = jest.fn(
      async (): Promise<PostOutcome> => ({ status: 200, body: null })
    )
    await editThree(drafts, { outbox, post })
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    // O lote ainda não está no outbox: o registro fica
    await act(async () => {
      await Promise.resolve()
    })
    expect(await saved(drafts)).toBe(3)
    await act(async () => {
      release()
      await gate
    })
    await waitFor(async () => expect(await saved(drafts)).toBe(0))
  })

  it('ficha travada só oferece "Descartar", com o motivo', async () => {
    const drafts = createPersistedDraftStore(createMemoryStorage())
    ;(await editThree(drafts)).unmount()
    calls.characterGet.mockResolvedValue(
      character({ status: 'active', lockedAt: '2026-11-01T15:00:00Z' })
    )
    renderWithSession(<SheetScreen id={ID} />, await signedIn(), { drafts })
    expect(
      await screen.findByText('A ficha não pode ser editada agora.')
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recuperar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Descartar' })).toBeTruthy()
  })

  it('sem acesso à ficha (404), o registro sai', async () => {
    const drafts = createPersistedDraftStore(createMemoryStorage())
    ;(await editThree(drafts)).unmount()
    calls.characterGet.mockResolvedValue({
      data: null,
      error: { status: 404, value: { error: 'não encontrado' } },
    })
    renderWithSession(<SheetScreen id={ID} />, await signedIn(), { drafts })
    expect(
      await screen.findByText('Você não tem acesso a esta ficha')
    ).toBeTruthy()
    await waitFor(async () => expect(await saved(drafts)).toBe(0))
    // T-17 (QAW-05): nada de "Salvo" na tela sem acesso
    expect(screen.queryByLabelText(/^Sincronização: /)).toBeNull()
  })

  it('o cabeçalho acompanha o rascunho: Salvar volta a "Salvo"', async () => {
    const drafts = createPersistedDraftStore(createMemoryStorage())
    const post = jest.fn(
      async (_: string, b: QueuedBatch): Promise<PostOutcome> => ({
        status: 200,
        body: { sheetVersion: 4, sheet: example('helena').sheet, b },
      })
    )
    await editThree(drafts, { post })
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(
      await screen.findByLabelText(/^Sincronização: (Salvando…|Salvo)$/)
    ).toBeTruthy()
    expect(screen.queryByLabelText(/alterações não salvas$/)).toBeNull()
  })
})
