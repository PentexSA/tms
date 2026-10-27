import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Share } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen from '../(app)/chronicles/[id]/index'
import NewChronicleScreen from '../(app)/chronicles/new'
import ChroniclesScreen from '../(app)/index'
import JoinScreen from '../(app)/join'

// A fábrica do jest.mock roda antes dos imports: o Eden falso nasce nela
jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))

const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const VTM = {
  code: 'vtm-v20',
  name: 'Vampiro: A Máscara — Edição de 20º Aniversário',
  family: 'wod',
}
const CHRONICLE_ID = '00000000-0000-4000-8000-0000000000c1'

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await session.restore()
  return session
}

describe('Crônicas (lista)', () => {
  it('mostra papel, narrador e número de personagens', async () => {
    calls.chroniclesGet.mockResolvedValue(
      ok([
        {
          id: CHRONICLE_ID,
          name: 'Crônica da Liberdade',
          system: VTM,
          role: 'storyteller',
          storyteller: { username: 'ana' },
          characterCount: 3,
        },
        {
          id: 'c2',
          name: 'Noites de São Paulo',
          system: VTM,
          role: 'player',
          storyteller: { username: 'beto' },
          characterCount: 1,
        },
      ])
    )
    renderWithSession(<ChroniclesScreen />, await signedIn())
    const mine = await screen.findByRole('button', {
      name: `Crônica da Liberdade, ${VTM.name}, Você narra · 3 personagens`,
    })
    expect(
      screen.getByRole('button', {
        name: `Noites de São Paulo, ${VTM.name}, Narrador: beto · 1 personagem`,
      })
    ).toBeTruthy()
    fireEvent.press(mine)
    expect(router.push).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
  })

  it('vazio: criar ou entrar com convite', async () => {
    calls.chroniclesGet.mockResolvedValue(ok([]))
    renderWithSession(<ChroniclesScreen />, await signedIn())
    expect(
      await screen.findByRole('header', {
        name: 'Você ainda não participa de nenhuma crônica',
      })
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
    fireEvent.press(screen.getByRole('button', { name: 'Entrar com convite' }))
    expect(router.push.mock.calls).toEqual([['/chronicles/new'], ['/join']])
  })

  it('erro: mensagem e tentar de novo', async () => {
    calls.chroniclesGet.mockResolvedValueOnce(fail(500, 'erro interno'))
    calls.chroniclesGet.mockResolvedValueOnce(ok([]))
    renderWithSession(<ChroniclesScreen />, await signedIn())
    expect(await screen.findByText('erro interno')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('header', {
        name: 'Você ainda não participa de nenhuma crônica',
      })
    ).toBeTruthy()
  })

  it('"Conta" abre a tela da conta', async () => {
    calls.chroniclesGet.mockResolvedValue(ok([]))
    renderWithSession(<ChroniclesScreen />, await signedIn())
    fireEvent.press(screen.getByRole('button', { name: 'Conta' }))
    expect(router.push).toHaveBeenCalledWith('/account')
  })

  it('sair encerra a sessão', async () => {
    calls.chroniclesGet.mockResolvedValue(ok([]))
    const session = await signedIn()
    renderWithSession(<ChroniclesScreen />, session)
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
    })
    await waitFor(() => expect(session.getState().status).toBe('signedOut'))
  })
})

describe('Nova crônica', () => {
  it('com um sistema só, ele já vem escolhido; criar abre a crônica', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    calls.chroniclesPost.mockResolvedValue(
      ok({
        id: CHRONICLE_ID,
        name: 'Liberdade',
        system: VTM,
        role: 'storyteller',
      })
    )
    renderWithSession(<NewChronicleScreen />, await signedIn())
    const radio = await screen.findByRole('radio', { name: VTM.name })
    expect(radio).toBeChecked()
    fireEvent.changeText(screen.getByTestId('chronicle-name'), '  Liberdade ')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
    })
    expect(calls.chroniclesPost).toHaveBeenCalledWith({
      name: 'Liberdade',
      systemCode: 'vtm-v20',
    })
    expect(router.replace).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
  })

  it('sem nome, avisa e não chama a API', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: VTM.name })
    fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
    expect(screen.getByText('Dê um nome à crônica')).toBeTruthy()
    expect(calls.chroniclesPost).not.toHaveBeenCalled()
  })

  it('erro da API aparece como alerta', async () => {
    calls.systemsGet.mockResolvedValue(ok([VTM]))
    calls.chroniclesPost.mockResolvedValue(fail(400, 'dados inválidos'))
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: VTM.name })
    fireEvent.changeText(screen.getByTestId('chronicle-name'), '<b>x</b>')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar crônica' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'dados inválidos'
    )
  })

  it('com vários sistemas, escolher antes de criar', async () => {
    calls.systemsGet.mockResolvedValue(
      ok([VTM, { code: 'mta-m20', name: 'Mago', family: 'wod' }])
    )
    renderWithSession(<NewChronicleScreen />, await signedIn())
    await screen.findByRole('radio', { name: 'Mago' })
    expect(screen.getByRole('button', { name: 'Criar crônica' })).toBeDisabled()
    fireEvent.press(screen.getByRole('radio', { name: 'Mago' }))
    expect(screen.getByRole('button', { name: 'Criar crônica' })).toBeEnabled()
  })
})

describe('Entrar com convite', () => {
  it('entra e abre a crônica', async () => {
    calls.acceptPost.mockResolvedValue(
      ok({ chronicleId: CHRONICLE_ID, role: 'player' })
    )
    renderWithSession(<JoinScreen />, await signedIn())
    fireEvent.changeText(screen.getByTestId('invite-code'), ' abcd efgh ')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar na crônica' }))
    })
    expect(calls.acceptPost).toHaveBeenCalledWith({ code: 'abcd efgh' })
    expect(router.replace).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
  })

  it('código inválido: mensagem genérica', async () => {
    calls.acceptPost.mockResolvedValue(
      fail(404, 'convite inválido ou expirado')
    )
    renderWithSession(<JoinScreen />, await signedIn())
    fireEvent.changeText(screen.getByTestId('invite-code'), 'XXXX')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Entrar na crônica' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'convite inválido ou expirado'
    )
  })
})

describe('Crônica (detalhe)', () => {
  const detail = (
    role: 'storyteller' | 'player',
    members = [{ id: 'u2', username: 'beto' }]
  ) =>
    ok({
      id: CHRONICLE_ID,
      name: 'Crônica da Liberdade',
      system: VTM,
      role,
      storyteller: { id: 'u1', username: 'ana' },
      members,
    })

  beforeEach(() => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE_ID })
  })

  it('jogador vê a mesa e não vê o convite', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Crônica da Liberdade' })
    ).toBeTruthy()
    expect(screen.getByText('Narrador: ana')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Voltar para Crônicas' })
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Convidar' })).toBeNull()
    expect(calls.chronicleIds).toContain(CHRONICLE_ID)
  })

  it('jogador não vê "Excluir crônica"', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    await screen.findByText('Narrador: ana')
    expect(screen.queryByRole('button', { name: 'Excluir crônica' })).toBeNull()
  })

  it('narrador exclui a crônica digitando o nome', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    calls.chronicle.delete.mockResolvedValue(ok(null))
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(
      await screen.findByRole('button', { name: 'Excluir crônica' })
    )
    const confirm = () =>
      screen.getAllByRole('button', { name: 'Excluir crônica' }).at(-1)
    // Sem o nome certo, o botão do sheet fica desabilitado
    expect(confirm()).toBeDisabled()
    const field = screen.getByLabelText(
      'Digite o nome da crônica para confirmar'
    )
    fireEvent.changeText(field, 'crônica da liberdade')
    expect(confirm()).toBeDisabled()
    fireEvent.changeText(field, ' Crônica da Liberdade ')
    expect(confirm()).toBeEnabled()
    await act(async () => {
      fireEvent.press(confirm() as never)
    })
    expect(calls.chronicle.delete).toHaveBeenCalledWith(CHRONICLE_ID, {
      confirm: 'Crônica da Liberdade',
    })
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('erro ao excluir aparece no sheet', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    calls.chronicle.delete.mockResolvedValue(fail(500, 'erro interno'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(
      await screen.findByRole('button', { name: 'Excluir crônica' })
    )
    fireEvent.changeText(
      screen.getByLabelText('Digite o nome da crônica para confirmar'),
      'Crônica da Liberdade'
    )
    await act(async () => {
      fireEvent.press(
        screen
          .getAllByRole('button', { name: 'Excluir crônica' })
          .at(-1) as never
      )
    })
    expect(await screen.findByText('erro interno')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalledWith('/')
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
  })

  it('crônica alheia: não encontrada', async () => {
    calls.chronicle.get.mockResolvedValue(fail(404, 'não encontrado'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Crônica não encontrada' })
    ).toBeTruthy()
  })

  it('outro erro: tentar de novo', async () => {
    calls.chronicle.get.mockResolvedValueOnce(fail(500, 'erro interno'))
    calls.chronicle.get.mockResolvedValueOnce(detail('player'))
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(
      await screen.findByRole('button', { name: 'Tentar de novo' })
    )
    expect(await screen.findByText('Narrador: ana')).toBeTruthy()
  })

  it('narrador gera o convite, copia, compartilha e revoga', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller', []))
    calls.chronicle.invitesGet.mockResolvedValue(
      ok([
        {
          id: 'i1',
          createdAt: '2026-10-18T12:00:00Z',
          expiresAt: '2026-10-25T12:00:00Z',
          maxUses: 10,
          uses: 2,
          active: true,
        },
        {
          id: 'i0',
          createdAt: '2026-10-01T12:00:00Z',
          expiresAt: '2026-10-08T12:00:00Z',
          maxUses: 10,
          uses: 0,
          active: false,
        },
      ])
    )
    calls.chronicle.invitesPost.mockResolvedValue(
      ok({
        id: 'i2',
        code: 'ABCDEFGHJKMNPQRSTVWXYZ0123',
        expiresAt: '',
        maxUses: 10,
      })
    )
    calls.chronicle.invitesDelete.mockResolvedValue(ok(null))
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined })
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(await screen.findByText('Você narra esta crônica.')).toBeTruthy()
    expect(
      screen.getByText(
        'Ninguém entrou ainda. Convide os jogadores com um código.'
      )
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Convidar' }))

    expect(
      await screen.findByText('8 usos restantes · vale até 25/10')
    ).toBeTruthy()
    // Só os ativos aparecem
    expect(screen.queryByText(/vale até 08\/10/)).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Gerar convite' }))
    })
    expect(
      await screen.findByText('ABCD EFGH JKMN PQRS TVWX YZ01 23')
    ).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Copiar código' }))
    })
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      'ABCDEFGHJKMNPQRSTVWXYZ0123'
    )
    expect(await screen.findByText('Código copiado')).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Compartilhar' }))
    expect(share).toHaveBeenCalledWith({
      message:
        'Entre na crônica "Crônica da Liberdade" no TMS com o código ABCD EFGH JKMN PQRS TVWX YZ01 23',
    })

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Revogar' }))
    })
    await waitFor(() =>
      expect(calls.chronicle.invitesDelete).toHaveBeenCalledWith('i1')
    )

    // Fechar esconde o código: reabrir não mostra o mesmo
    fireEvent.press(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Convidar' }))
    expect(screen.queryByText('ABCD EFGH JKMN PQRS TVWX YZ01 23')).toBeNull()
  })

  it('erro ao gerar o convite aparece no sheet', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    calls.chronicle.invitesGet.mockResolvedValue(ok([]))
    calls.chronicle.invitesPost.mockResolvedValue(
      fail(403, 'só o narrador pode fazer isso')
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    fireEvent.press(await screen.findByRole('button', { name: 'Convidar' }))
    expect(await screen.findByText('Nenhum convite ativo.')).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Gerar convite' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'só o narrador pode fazer isso'
    )
  })
})
