import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, fail, ok } from '../../../test/fake-api'
import { renderWithQueryClient } from '../../../test/utils'
import { CampaignBackstage } from '../CampaignBackstage'

// v5, entrega 12: diário, apresentação, transferência e auditoria. Comandos
// novos guardam a chave enquanto a intenção é a mesma (reenvio seguro) e o
// jogador não recebe nenhum controle do narrador.

// Função comum, não jest.fn: o resetMocks não a zera, e cada chave é única
jest.mock('expo-crypto', () => {
  let n = 0
  return {
    randomUUID: () =>
      `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  }
})

jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})

const { chronicle } = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const ID = '00000000-0000-4000-8000-0000000000c1'
const BRUNO = { id: '00000000-0000-4000-8000-0000000000b1', username: 'bruno' }
const NPC = '00000000-0000-4000-8000-00000000c009'
const PC = '00000000-0000-4000-8000-00000000c001'

const info = (extra: Record<string, unknown> = {}) => ({
  id: ID,
  name: 'Crônica da Liberdade',
  description: 'Boston, 1999',
  imageUrl: null,
  settingsRevision: 3,
  members: [BRUNO],
  ...extra,
})

const session = {
  id: '00000000-0000-4000-8000-00000000e001',
  date: '2026-10-20',
  title: 'A noite do oráculo',
  summary: 'O grupo encontra o oráculo.',
  privateNotes: 'O oráculo mente.',
  revision: 2,
}

const bodyOf = (mock: jest.Mock, call = -1) =>
  mock.mock.calls.at(call)?.at(-1) as Record<string, unknown>

beforeEach(() => {
  chronicle.charactersGet.mockResolvedValue(
    ok([
      { id: PC, projection: 'full', name: 'Helena' },
      {
        id: NPC,
        projection: 'identity',
        identity: { name: 'Oráculo', chip: '', subtitle: null },
      },
    ])
  )
})

describe('narrador', () => {
  it('registra a sessão e reenvia com a mesma chave após erro', async () => {
    chronicle.sessionsPost
      .mockResolvedValueOnce(fail(503, 'Sem conexão com o servidor.'))
      .mockResolvedValueOnce(ok(session))
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    expect(await screen.findByText('Nenhuma sessão registrada.')).toBeTruthy()
    const register = screen.getByRole('button', { name: 'Registrar sessão' })
    expect(register).toBeDisabled()

    fireEvent.changeText(screen.getByLabelText('Data'), '2026-10-20')
    fireEvent.changeText(
      screen.getByLabelText('Título da sessão'),
      session.title
    )
    fireEvent.changeText(
      screen.getByLabelText('Resumo público'),
      session.summary
    )
    fireEvent.changeText(
      screen.getByLabelText('Notas privadas do narrador'),
      session.privateNotes
    )
    fireEvent.press(screen.getByRole('button', { name: 'Registrar sessão' }))
    expect(await screen.findByText('Sem conexão com o servidor.')).toBeTruthy()
    const first = bodyOf(chronicle.sessionsPost)
    expect(first).toMatchObject({
      date: '2026-10-20',
      title: session.title,
      summary: session.summary,
      privateNotes: session.privateNotes,
    })

    fireEvent.press(screen.getByRole('button', { name: 'Reenviar registro' }))
    await waitFor(() => expect(chronicle.sessionsPost).toHaveBeenCalledTimes(2))
    expect(bodyOf(chronicle.sessionsPost).clientCommandId).toBe(
      first.clientCommandId
    )
    // Sucesso limpa o formulário e revalida o diário
    await waitFor(() =>
      expect(screen.getByLabelText('Título da sessão').props.value).toBe('')
    )
    expect(chronicle.sessionsGet.mock.calls.length).toBeGreaterThan(1)
  })

  it('mudar o texto depois de um erro gera outra chave', async () => {
    chronicle.sessionsPost.mockResolvedValue(fail(409, 'Conflito'))
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    await screen.findByText('Nenhuma sessão registrada.')
    fireEvent.changeText(screen.getByLabelText('Título da sessão'), 'Um')
    fireEvent.press(screen.getByRole('button', { name: 'Registrar sessão' }))
    await screen.findByText('Conflito')
    fireEvent.changeText(screen.getByLabelText('Título da sessão'), 'Dois')
    fireEvent.press(screen.getByRole('button', { name: 'Registrar sessão' }))
    await waitFor(() => expect(chronicle.sessionsPost).toHaveBeenCalledTimes(2))
    expect(bodyOf(chronicle.sessionsPost).clientCommandId).not.toBe(
      bodyOf(chronicle.sessionsPost, 0).clientCommandId
    )
  })

  it('edita a sessão com a revisão lida e as notas privadas', async () => {
    chronicle.sessionsGet.mockResolvedValue(ok({ items: [session] }))
    chronicle.sessionPatch.mockResolvedValue(ok({ ...session, revision: 3 }))
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    expect(await screen.findByText(session.title)).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Editar' }))
    const titles = screen.getAllByLabelText('Título da sessão')
    expect(titles).toHaveLength(2)
    fireEvent.changeText(titles[1]!, 'A noite do falso oráculo')
    fireEvent.press(screen.getByRole('button', { name: 'Salvar sessão' }))
    await waitFor(() => expect(chronicle.sessionPatch).toHaveBeenCalled())
    expect(chronicle.sessionPatch.mock.calls[0]![1]).toBe(session.id)
    expect(bodyOf(chronicle.sessionPatch)).toMatchObject({
      revision: 2,
      date: session.date,
      title: 'A noite do falso oráculo',
      privateNotes: session.privateNotes,
    })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Salvar sessão' })).toBeNull()
    )
  })

  it('cancelar a edição não envia nada; erro aparece no formulário', async () => {
    chronicle.sessionsGet.mockResolvedValue(
      ok({ items: [{ ...session, summary: '', privateNotes: undefined }] })
    )
    chronicle.sessionPatch.mockResolvedValue(
      fail(409, 'Os dados mudaram. Atualize para continuar.')
    )
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    expect(await screen.findByText('Sem resumo público.')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(chronicle.sessionPatch).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.changeText(
      screen.getAllByLabelText('Resumo público')[1]!,
      'Agora com resumo'
    )
    fireEvent.changeText(
      screen.getAllByLabelText('Notas privadas do narrador')[1]!,
      'nota'
    )
    fireEvent.press(screen.getByRole('button', { name: 'Salvar sessão' }))
    expect(
      await screen.findByText('Os dados mudaram. Atualize para continuar.')
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reenviar edição' })).toBeTruthy()
  })

  it('salva apresentação e regras da casa declaradas pelo template', async () => {
    chronicle.patch.mockResolvedValue(ok({ id: ID }))
    renderWithQueryClient(
      <CampaignBackstage
        narrating
        chronicle={info({
          options: { lenient: false },
          optionCatalog: [
            {
              id: 'lenient',
              label: 'Regra leniente',
              help: 'Uma ajuda',
              type: 'boolean',
              default: false,
            },
            {
              id: 'pace',
              label: 'Ritmo',
              type: 'enum',
              default: 'slow',
              values: [
                { id: 'slow', label: 'Lento' },
                { id: 'fast', label: 'Rápido' },
              ],
            },
            {
              id: 'bonus',
              label: 'Bônus',
              type: 'integer',
              default: 1,
              min: 0,
              max: 3,
            },
          ],
        })}
      />
    )
    expect(await screen.findByText('Regras da casa')).toBeTruthy()
    expect(screen.getByText('Uma ajuda')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Desligada' }))
    expect(screen.getByRole('button', { name: 'Ligada' })).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Rápido' }))
    fireEvent.changeText(screen.getByLabelText('0 a 3'), 'x')
    fireEvent.changeText(screen.getByLabelText('0 a 3'), '2')
    fireEvent.changeText(screen.getByLabelText('Nome'), 'Crônica Nova')
    fireEvent.changeText(screen.getByLabelText('Descrição'), 'Chicago')
    fireEvent.changeText(screen.getByLabelText('Imagem HTTPS'), '   ')
    fireEvent.press(screen.getByRole('button', { name: 'Salvar apresentação' }))
    await waitFor(() => expect(chronicle.patch).toHaveBeenCalled())
    expect(bodyOf(chronicle.patch)).toMatchObject({
      revision: 3,
      name: 'Crônica Nova',
      description: 'Chicago',
      imageUrl: null,
      options: { lenient: true, pace: 'fast', bonus: 2 },
    })
  })

  it('sem catálogo não desenha regras da casa; erro mantém a chave', async () => {
    chronicle.patch.mockResolvedValue(
      fail(422, 'Escolha um valor permitido pelo template.')
    )
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    await screen.findByText('Apresentação')
    expect(screen.queryByText('Regras da casa')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Salvar apresentação' }))
    expect(
      await screen.findByText('Escolha um valor permitido pelo template.')
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Reenviar alterações' }))
    await waitFor(() => expect(chronicle.patch).toHaveBeenCalledTimes(2))
    expect(bodyOf(chronicle.patch).clientCommandId).toBe(
      bodyOf(chronicle.patch, 0).clientCommandId
    )
  })

  it('propõe a transferência e reenvia com a mesma chave', async () => {
    chronicle.transferPost
      .mockResolvedValueOnce(fail(503))
      .mockResolvedValueOnce(ok({ id: 't1' }))
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    expect(await screen.findByText('bruno')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Propor' }))
    await waitFor(() => expect(chronicle.transferPost).toHaveBeenCalled())
    fireEvent.press(screen.getByRole('button', { name: 'Propor' }))
    await waitFor(() => expect(chronicle.transferPost).toHaveBeenCalledTimes(2))
    expect(bodyOf(chronicle.transferPost)).toEqual(
      bodyOf(chronicle.transferPost, 0)
    )
    expect(bodyOf(chronicle.transferPost).recipientId).toBe(BRUNO.id)
  })

  it('sem membros não oferece transferência', async () => {
    renderWithQueryClient(
      <CampaignBackstage chronicle={info({ members: [] })} narrating />
    )
    expect(
      await screen.findByText('Convide um membro antes de transferir.')
    ).toBeTruthy()
  })

  it('pedido pendente: aguarda o destinatário e pode ser cancelado', async () => {
    chronicle.transferGet.mockResolvedValue(
      ok({
        id: 't1',
        status: 'pending',
        recipient: BRUNO,
        expiresAt: '2026-10-30T00:00:00Z',
        available: true,
      })
    )
    chronicle.transferDecision.mockResolvedValue(ok({ status: 'cancelled' }))
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    expect(await screen.findByText(/Aguardando bruno aceitar/)).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Cancelar transferência' })
    )
    await waitFor(() =>
      expect(chronicle.transferDecision).toHaveBeenCalledWith(
        ID,
        't1',
        'cancel',
        { clientCommandId: expect.any(String) }
      )
    )
  })

  it('pedido vencido: volta a oferecer os membros', async () => {
    chronicle.transferGet.mockResolvedValue(
      ok({
        id: 't1',
        status: 'pending',
        recipient: BRUNO,
        expiresAt: '2026-10-01T00:00:00Z',
        available: false,
      })
    )
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    await waitFor(() => expect(chronicle.transferGet).toHaveBeenCalled())
    // Deixa a resposta chegar à tela antes de conferir o que ela não mostra
    await act(() => Promise.resolve())
    expect(screen.queryByText(/Aguardando/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Propor' })).toBeTruthy()
  })

  it('auditoria: filtra por ficha e período e carrega a página anterior', async () => {
    chronicle.historyGet
      .mockResolvedValueOnce(
        ok({
          items: [
            {
              id: 'a1',
              source: 'audit',
              action: 'chronicle.update',
              at: '2026-10-22T10:00:00Z',
              by: { id: 'u1', username: 'ana' },
            },
            {
              id: 'b1',
              source: 'batch',
              action: 'sheet.events',
              at: '2026-10-21T10:00:00Z',
              by: null,
            },
          ],
          nextCursor: 'cursor-1',
        })
      )
      .mockResolvedValue(ok({ items: [], nextCursor: null }))
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    expect(await screen.findByText('chronicle.update')).toBeTruthy()
    expect(screen.getByText('Conta excluída')).toBeTruthy()

    fireEvent.press(
      screen.getByRole('button', { name: 'Carregar histórico anterior' })
    )
    await waitFor(() =>
      expect(chronicle.historyGet).toHaveBeenLastCalledWith(
        ID,
        expect.objectContaining({
          query: { limit: 50, cursor: 'cursor-1' },
        })
      )
    )

    fireEvent.press(await screen.findByText('Oráculo'))
    fireEvent.changeText(
      screen.getByLabelText('Desde (AAAA-MM-DD)'),
      '2026-10-01'
    )
    fireEvent.changeText(
      screen.getByLabelText('Até (AAAA-MM-DD)'),
      '2026-13-40'
    )
    fireEvent.changeText(
      screen.getByLabelText('Até (AAAA-MM-DD)'),
      '2026-10-31'
    )
    await waitFor(() =>
      expect(chronicle.historyGet).toHaveBeenLastCalledWith(
        ID,
        expect.objectContaining({
          query: {
            limit: 50,
            characterId: NPC,
            from: '2026-10-01T00:00:00.000Z',
            to: '2026-10-31T23:59:59.999Z',
          },
        })
      )
    )
    // Data inválida não vira filtro
    expect(
      chronicle.historyGet.mock.calls.some(
        call => (call[1] as { query: { to?: string } }).query.to === undefined
      )
    ).toBe(true)

    fireEvent.press(screen.getByText('Helena'))
    fireEvent.press(screen.getByText('Todas as fichas'))
    await waitFor(() =>
      expect(chronicle.historyGet).toHaveBeenLastCalledWith(
        ID,
        expect.objectContaining({
          query: expect.not.objectContaining({
            characterId: expect.anything(),
          }),
        })
      )
    )
  })

  it('auditoria com erro mostra a mensagem', async () => {
    chronicle.historyGet.mockResolvedValue(fail(404, 'Não encontrado.'))
    renderWithQueryClient(<CampaignBackstage chronicle={info()} narrating />)
    expect(await screen.findByText('Não encontrado.')).toBeTruthy()
  })
})

describe('jogador', () => {
  it('lê só o diário público, sem controles do narrador', async () => {
    chronicle.sessionsGet.mockResolvedValue(
      ok({
        items: [
          {
            id: session.id,
            date: session.date,
            title: session.title,
            summary: session.summary,
            revision: 2,
          },
        ],
      })
    )
    renderWithQueryClient(
      <CampaignBackstage chronicle={info()} narrating={false} />
    )
    expect(await screen.findByText(session.title)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(screen.queryByText('Registrar sessão')).toBeNull()
    expect(screen.queryByText('Apresentação')).toBeNull()
    expect(screen.queryByText('Transferir narração')).toBeNull()
    expect(screen.queryByText('Auditoria')).toBeNull()
    expect(screen.queryByText('Convite para narrar')).toBeNull()
    expect(chronicle.historyGet).not.toHaveBeenCalled()
  })

  it('destinatário aceita a narração; aceitar limpa o cache', async () => {
    chronicle.transferGet.mockResolvedValue(
      ok({
        id: 't1',
        status: 'pending',
        recipient: BRUNO,
        expiresAt: '2026-10-30T00:00:00Z',
        available: true,
      })
    )
    chronicle.transferDecision.mockResolvedValue(ok({ status: 'accepted' }))
    const { queryClient } = renderWithQueryClient(
      <CampaignBackstage chronicle={info()} narrating={false} />
    )
    expect(await screen.findByText('Convite para narrar')).toBeTruthy()
    const clear = jest.spyOn(queryClient, 'clear')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Aceitar narração' }))
    })
    await waitFor(() => expect(clear).toHaveBeenCalled())
    expect(chronicle.transferDecision).toHaveBeenCalledWith(
      ID,
      't1',
      'accept',
      {
        clientCommandId: expect.any(String),
      }
    )
  })

  it('destinatário recusa', async () => {
    chronicle.transferGet.mockResolvedValue(
      ok({
        id: 't1',
        status: 'pending',
        recipient: BRUNO,
        expiresAt: '2026-10-30T00:00:00Z',
        available: true,
      })
    )
    chronicle.transferDecision.mockResolvedValue(ok({ status: 'rejected' }))
    renderWithQueryClient(
      <CampaignBackstage chronicle={info()} narrating={false} />
    )
    fireEvent.press(await screen.findByRole('button', { name: 'Recusar' }))
    await waitFor(() =>
      expect(chronicle.transferDecision).toHaveBeenCalledWith(
        ID,
        't1',
        'reject',
        { clientCommandId: expect.any(String) }
      )
    )
  })

  it('pedido vencido não oferece aceite', async () => {
    chronicle.transferGet.mockResolvedValue(
      ok({
        id: 't1',
        status: 'pending',
        recipient: BRUNO,
        expiresAt: '2026-10-01T00:00:00Z',
        available: false,
      })
    )
    renderWithQueryClient(
      <CampaignBackstage chronicle={info()} narrating={false} />
    )
    await waitFor(() => expect(chronicle.transferGet).toHaveBeenCalled())
    await screen.findByText('Diário da crônica')
    expect(screen.queryByText('Convite para narrar')).toBeNull()
  })
})
