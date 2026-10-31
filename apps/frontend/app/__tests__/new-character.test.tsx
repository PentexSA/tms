import { act, fireEvent, screen } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import { templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleScreen from '../(app)/chronicles/[id]/index'
import NewCharacterScreen from '../(app)/chronicles/[id]/new-character'

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() }
const CHRONICLE = '00000000-0000-4000-8000-0000000000c1'
const VTM = { code: 'vtm-v20', name: 'Vampiro: A Máscara' }

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE })
  calls.chronicle.get.mockResolvedValue(
    ok({
      id: CHRONICLE,
      name: 'Crônica da Liberdade',
      system: VTM,
      role: 'player',
      storyteller: { id: 'u1', username: 'ana' },
      members: [],
    })
  )
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

describe('Nova ficha', () => {
  it('cria pela identidade e abre a ficha', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(ok({ id: 'ch1' }))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(
      await screen.findByTestId('editor-name'),
      'Helena Varga'
    )
    fireEvent.press(screen.getByRole('radio', { name: 'Tremere' }))
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(calls.chronicle.charactersPost).toHaveBeenCalledWith({
      values: { name: 'Helena Varga', clan: 'tremere' },
    })
    // O Vampiro tem criação por pontos: a ficha nova abre na Criação
    expect(router.replace).toHaveBeenCalledWith('/characters/ch1?mode=create')
    // O template mais recente do sistema da crônica
    expect(calls.templateGet).toHaveBeenCalledWith(
      'vtm-v20',
      expect.objectContaining({ query: {} })
    )
  })

  it('Natureza e Comportamento saem da lista do livro', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(ok({ id: 'ch1' }))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'Helena')
    fireEvent.press(screen.getByTestId('suggest-nature'))
    fireEvent.press(screen.getByRole('button', { name: 'Arquiteto' }))
    // O texto continua livre
    fireEvent.changeText(screen.getByTestId('editor-demeanor'), 'Galã')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(calls.chronicle.charactersPost).toHaveBeenCalledWith({
      values: { name: 'Helena', nature: 'Arquiteto', demeanor: 'Galã' },
    })
  })

  it('422 do servidor marca o campo', async () => {
    calls.chronicle.charactersPost.mockResolvedValue({
      data: null,
      error: {
        status: 422,
        value: {
          error: 'ficha inválida',
          issues: [{ path: '/values/name', message: 'informe o nome' }],
        },
      },
    })
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'X')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('informe o nome')
  })

  it('outro erro aparece como faixa', async () => {
    calls.chronicle.charactersPost.mockResolvedValue(
      fail(422, 'limite de fichas nesta crônica')
    )
    renderWithSession(<NewCharacterScreen />, await signedIn())
    fireEvent.changeText(await screen.findByTestId('editor-name'), 'X')
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Criar ficha' }))
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'limite de fichas nesta crônica'
    )
  })

  it('template desconhecido: "Atualize o app"', async () => {
    const t = templateJson('vtm-v20')
    t.schema = 2
    calls.templateGet.mockResolvedValue(ok(t))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Atualize o app' })
    ).toBeTruthy()
  })

  it('crônica inacessível', async () => {
    calls.chronicle.get.mockResolvedValue(fail(404, 'não encontrado'))
    renderWithSession(<NewCharacterScreen />, await signedIn())
    expect(
      await screen.findByRole('header', {
        name: 'Não foi possível abrir a criação de ficha',
      })
    ).toBeTruthy()
  })
})

describe('Fichas na crônica', () => {
  it('lista com selo e resumo do core e leva à ficha', async () => {
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        {
          id: 'ch1',
          name: 'Helena Varga',
          mine: true,
          owner: { id: 'u2', username: 'dona' },
          templateVersion: '1.0.0',
          updatedAt: '',
          values: {
            name: 'Helena Varga',
            clan: 'tremere',
            concept: 'Arquivista',
            backgrounds: [{ id: 'b1', name: 'Geração', value: 5 }],
          },
        },
        {
          id: 'ch2',
          name: 'Caio',
          mine: false,
          owner: { id: 'u3', username: 'beto' },
          templateVersion: '1.0.0',
          updatedAt: '',
          values: { name: 'Caio' },
        },
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Suas fichas' })
    ).toBeTruthy()
    const mine = await screen.findByRole('button', {
      name: 'Helena Varga, Arquivista · 8ª geração, Tremere · Sua ficha',
    })
    // A API não manda a ficha de outro jogador; se mandasse, o app não mostra
    expect(screen.queryByRole('button', { name: /^Caio, / })).toBeNull()
    fireEvent.press(mine)
    expect(router.push).toHaveBeenCalledWith('/characters/ch1')
    fireEvent.press(screen.getByRole('button', { name: 'Nova ficha' }))
    expect(router.push).toHaveBeenCalledWith(
      `/chronicles/${CHRONICLE}/new-character`
    )
  })

  it('o narrador vê a ficha que aguarda a revisão dele', async () => {
    calls.chronicle.get.mockResolvedValue(
      ok({
        id: CHRONICLE,
        name: 'Crônica da Liberdade',
        system: VTM,
        role: 'storyteller',
        storyteller: { id: 'u1', username: 'ana' },
        members: [],
      })
    )
    calls.chronicle.charactersGet.mockResolvedValue(
      ok([
        {
          id: 'ch1',
          name: 'Helena Varga',
          mine: false,
          owner: { id: 'u2', username: 'dona' },
          status: 'pending',
          templateVersion: '1.0.0',
          updatedAt: '',
          values: { name: 'Helena Varga' },
        },
        {
          id: 'ch2',
          name: 'Caio',
          mine: false,
          owner: { id: 'u3', username: 'beto' },
          status: 'active',
          templateVersion: '1.0.0',
          updatedAt: '',
          values: { name: 'Caio' },
        },
      ])
    )
    renderWithSession(<ChronicleScreen />, await signedIn())
    expect(await screen.findByText('1 ficha aguarda sua revisão')).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: /^Helena Varga, .*de dona · Aguarda sua revisão$/,
      })
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /^Caio, .*de beto$/ })
    ).toBeTruthy()
  })

  it('sem fichas e com erro', async () => {
    calls.chronicle.charactersGet.mockResolvedValueOnce(ok([]))
    const session = await signedIn()
    const first = renderWithSession(<ChronicleScreen />, session)
    expect(
      await screen.findByText('Você ainda não tem ficha nesta crônica.')
    ).toBeTruthy()
    first.unmount()
    calls.chronicle.charactersGet.mockResolvedValue(fail(500, 'erro interno'))
    renderWithSession(<ChronicleScreen />, session)
    expect(await screen.findByText('erro interno')).toBeTruthy()
  })
})
