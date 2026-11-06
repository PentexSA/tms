import { fireEvent, screen, within } from '@testing-library/react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import * as apiModule from '../../lib/api'
import { type createFakeApi, fail, ok } from '../../test/fake-api'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import ChronicleAboutScreen from '../(app)/chronicles/[id]/about'

// A Apresentação da crônica para leitura (P14-D, U-09, D-15)

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})

const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(),
}
const CHRONICLE_ID = '00000000-0000-4000-8000-0000000000c1'
const VTM = {
  code: 'vtm-v20',
  name: 'Vampiro: A Máscara — Edição de 20º Aniversário',
}
const MARKUP = '*isto não é negrito* [nem link](https://exemplo.test)'
const DESCRIPTION = [
  'Parágrafo de teste do roteiro, número 1.\nCom uma quebra simples.',
  MARKUP,
  'Parágrafo de teste do roteiro, número 3.',
].join('\n\n')

const detail = (
  role: 'storyteller' | 'player' | 'former',
  description = DESCRIPTION
) =>
  ok({
    id: CHRONICLE_ID,
    name: 'Crônica da Liberdade',
    system: VTM,
    role,
    storyteller: { id: 'u1', username: 'ana' },
    description,
    imageUrl: null,
    members: [],
  })

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue(router as never)
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: CHRONICLE_ID })
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'refresh-0')
  )
  await session.restore()
  return session
}

describe('Apresentação da crônica (leitura)', () => {
  it('o jogador lê o texto inteiro, um Text por parágrafo, sem link', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    const subtitle = await screen.findByTestId('app-bar-subtitle')
    expect(within(subtitle).getByText('Crônica da Liberdade')).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Apresentação' })).toBeTruthy()
    const text = screen.getByTestId('chronicle-about-text')
    const parts = within(text).getAllByText(/./)
    expect(parts.map(p => p.props.children)).toEqual([
      'Parágrafo de teste do roteiro, número 1.\nCom uma quebra simples.',
      MARKUP,
      'Parágrafo de teste do roteiro, número 3.',
    ])
    // O texto é selecionável e nada vira link
    for (const part of parts) expect(part.props.selectable).toBe(true)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull()
  })

  it('o narrador lê a mesma tela', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller'))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    expect(await screen.findByText(MARKUP)).toBeTruthy()
    expect(screen.getAllByText(/Parágrafo de teste/)).toHaveLength(2)
  })

  it('o voltar se chama "Voltar para {crônica}" e volta à tela de baixo', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player'))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    const back = await screen.findByRole('button', {
      name: 'Voltar para Crônica da Liberdade',
    })
    router.canGoBack.mockReturnValue(true)
    fireEvent.press(back)
    expect(router.back).toHaveBeenCalled()
    // Link direto ou F5 no web: sem tela de baixo, abre a crônica
    router.canGoBack.mockReturnValue(false)
    fireEvent.press(back)
    expect(router.replace).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
  })

  it('enquanto carrega, o voltar sem tela de baixo abre a crônica da rota', async () => {
    // A resposta não chega durante o teste
    calls.chronicle.get.mockReturnValue(new Promise(() => undefined))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    const back = await screen.findByRole('button', {
      name: 'Voltar para Crônica',
    })
    router.canGoBack.mockReturnValue(false)
    fireEvent.press(back)
    expect(router.replace).toHaveBeenCalledWith(`/chronicles/${CHRONICLE_ID}`)
    expect(router.replace).not.toHaveBeenCalledWith('/')
  })

  it('crônica não encontrada: o voltar sem tela de baixo vai à lista', async () => {
    calls.chronicle.get.mockResolvedValue(fail(404, 'não encontrado'))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    await screen.findByRole('header', { name: 'Crônica não encontrada' })
    router.canGoBack.mockReturnValue(false)
    fireEvent.press(
      screen.getByRole('button', { name: 'Voltar para Crônicas' })
    )
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('crônica alheia ou convite não aceito: não encontrada', async () => {
    calls.chronicle.get.mockResolvedValue(fail(404, 'não encontrado'))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Crônica não encontrada' })
    ).toBeTruthy()
    expect(
      screen.getByText('Ela não existe ou você não participa dela.')
    ).toBeTruthy()
  })

  it('outro erro: tentar de novo', async () => {
    calls.chronicle.get.mockResolvedValueOnce(fail(500, 'erro interno'))
    calls.chronicle.get.mockResolvedValueOnce(detail('player'))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    expect(
      await screen.findByRole('header', {
        name: 'Não foi possível carregar a crônica',
      })
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText(MARKUP)).toBeTruthy()
  })

  it('o ex-membro não lê, mesmo que a resposta traga o texto', async () => {
    calls.chronicle.get.mockResolvedValue(detail('former'))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Você saiu desta crônica' })
    ).toBeTruthy()
    expect(
      screen.getByText('A apresentação é só para quem participa.')
    ).toBeTruthy()
    expect(screen.queryByText(MARKUP)).toBeNull()
  })

  it('sem Descrição: o jogador lê que o narrador não escreveu', async () => {
    calls.chronicle.get.mockResolvedValue(detail('player', '  \n\n '))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    expect(
      await screen.findByRole('header', { name: 'Sem apresentação' })
    ).toBeTruthy()
    expect(
      screen.getByText(
        'O narrador ainda não escreveu a apresentação desta crônica.'
      )
    ).toBeTruthy()
  })

  it('sem Descrição: o narrador lê onde escrever', async () => {
    calls.chronicle.get.mockResolvedValue(detail('storyteller', ''))
    renderWithSession(<ChronicleAboutScreen />, await signedIn())
    expect(
      await screen.findByText(
        'Escreva a apresentação em Bastidores › Apresentação.'
      )
    ).toBeTruthy()
  })
})
