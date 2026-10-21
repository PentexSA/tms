import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { RandomSource, RoleName, SheetData } from '@tms/sheet-core'
import { AccessibilityInfo } from 'react-native'

import * as apiModule from '../../../lib/api'
import { type createFakeApi, fail, ok } from '../../../test/fake-api'
import { example, modelOf, sheetFor } from '../../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../../test/session'
import { createSheetStore } from '../../store/sheetStore'
import { DiceButton } from '../DiceButton'
import { fold, matches } from '../fold'

// Etapa 21 na tela: montar a parada, rolar no servidor, rolar no aparelho
// sem rede e "Rolei na mão".

jest.mock('../../../lib/api', () => {
  const { createFakeApi } = require('../../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../../lib/api'), api: fake.api, fake }
})
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls
const ID = '00000000-0000-4000-8000-00000000c001'

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

/** Faces de d10 em ordem (o valor x sorteia 1 + x % 10). */
const faces = (...values: number[]): RandomSource => ({
  nextUint32: () => (values.shift() ?? 1) - 1,
})

function storeFor(
  roles: RoleName[] = ['owner'],
  sheet: SheetData = sheetFor('helena', roles).sheet,
  system = 'vtm-v20'
) {
  const enqueue = jest.fn()
  const store = createSheetStore({
    characterId: ID,
    model: modelOf(system),
    sheet,
    sheetVersion: 3,
    roles,
    sync: { enqueue },
    uuid: () => '00000000-0000-4000-8000-00000000b001',
  })
  return { store, enqueue }
}

async function open(
  store = storeFor().store,
  random: RandomSource = faces(10, 6)
) {
  let n = 0
  renderWithSession(
    <DiceButton
      characterId={ID}
      store={store}
      random={random}
      uuid={() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`}
    />,
    await signedIn()
  )
  fireEvent.press(screen.getByRole('button', { name: 'Dados' }))
  expect(screen.getByRole('header', { name: 'Dados' })).toBeTruthy()
}

function pick(slot: string, query: string, option: RegExp) {
  fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${slot}:`) }))
  fireEvent.changeText(
    screen.getByLabelText(`Buscar ${slot.toLowerCase()}`),
    query
  )
  fireEvent.press(screen.getByRole('button', { name: option }))
}

const serverRoll = (over: Record<string, unknown> = {}) =>
  ok({
    duplicate: false,
    sheetVersion: 3,
    sheet: sheetFor('helena', ['owner']).sheet,
    roll: {
      id: 'r1',
      at: '2026-10-18T12:00:00Z',
      by: { username: 'dona' },
      byRole: 'owner',
      label: 'Destreza + Esportes',
      manual: false,
      difficulty: 6,
      specialty: false,
      dice: 2,
      die: 10,
      penalty: -1,
      auto: 0,
      faces: [10, 6],
      total: 2,
      outcome: 'success',
      text: '2 sucessos',
      modifiers: [],
      ...over,
    },
  })

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined)
})

describe('o sheet Dados', () => {
  it('monta Destreza + Esportes com a penalidade e rola no servidor', async () => {
    calls.rollsPost.mockResolvedValue(serverRoll())
    await open()
    // Sem escolha ainda: não rola
    expect(screen.getByRole('button', { name: 'Rolar no app' })).toBeDisabled()
    pick('Atributo', 'des', /^Destreza, 2/)
    pick('Habilidade ou Disciplina', 'esport', /^Esportes, 1/)
    expect(
      screen.getByLabelText('Parada: 2 dados. Ferimento (Machucado): −1 dado')
    ).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
    })
    expect(calls.rollsPost).toHaveBeenCalledWith(ID, {
      clientRollId: '00000000-0000-4000-8000-000000000001',
      slots: { attribute: 'dexterity', ability: 'athletics' },
      difficulty: 6,
      specialty: false,
      boosts: [],
    })
    // O cliente nunca manda resultado
    const sent = calls.rollsPost.mock.calls[0]?.[1] as Record<string, unknown>
    expect(Object.keys(sent)).not.toContain('faces')
    expect(screen.getByText('2 sucessos')).toBeTruthy()
    expect(screen.getByText('Dados: 10 · 6')).toBeTruthy()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Destreza + Esportes: 2 sucessos. Dados: 10, 6.'
    )
  })

  it('sem rede: rola no aparelho, marca como local e o custo vai pela fila', async () => {
    calls.rollsPost.mockRejectedValue(new TypeError('Network request failed'))
    const { store, enqueue } = storeFor()
    await open(store, faces(1, 3))
    pick('Atributo', 'des', /^Destreza, 2/)
    pick('Habilidade ou Disciplina', 'esport', /^Esportes, 1/)
    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Gastar 1 Força de Vontade: +1 sucesso automático',
      })
    )
    expect(
      screen.getByRole('checkbox', { name: /^Gastar 1 Força/, checked: true })
    ).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
    })
    // 1 e 3: nenhum sucesso nos dados, mas o automático da FdV vale
    expect(screen.getByText('1 sucesso')).toBeTruthy()
    expect(
      screen.getByText('dificuldade 6 · no aparelho, sem rede')
    ).toBeTruthy()
    expect(enqueue).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({
        events: [
          {
            path: 'values.willpower',
            from: { current: 5, permanent: 7 },
            to: { current: 4, permanent: 7 },
          },
        ],
      })
    )
    expect(
      (store.getState().values.values as { willpower: unknown }).willpower
    ).toEqual({ current: 4, permanent: 7 })
  })

  it('"Rolei na mão": manda só o total informado', async () => {
    calls.rollsPost.mockResolvedValue(
      serverRoll({ manual: true, faces: [], total: 1, text: '1 sucesso' })
    )
    await open()
    pick('Atributo', 'raci', /^Raciocínio, 3/)
    fireEvent.press(screen.getByRole('button', { name: 'Rolei na mão' }))
    fireEvent(
      screen.getByRole('adjustable', { name: 'Sucessos nos dados' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Registrar' }))
    })
    expect(calls.rollsPost).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({
        slots: { attribute: 'wits' },
        manual: { successes: 1, botch: false },
      })
    )
    expect(screen.getByText('1 sucesso')).toBeTruthy()
    expect(screen.getByText('dificuldade 6 · na mão')).toBeTruthy()
  })

  it('falha crítica na mão só com zero sucessos; cancelar volta', async () => {
    await open()
    pick('Atributo', 'raci', /^Raciocínio, 3/)
    fireEvent.press(screen.getByRole('button', { name: 'Rolei na mão' }))
    expect(screen.getByRole('checkbox', { name: 'Falha crítica' })).toBeTruthy()
    fireEvent(
      screen.getByRole('adjustable', { name: 'Sucessos nos dados' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    expect(screen.queryByRole('checkbox', { name: 'Falha crítica' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Rolar no app' })).toBeTruthy()
  })

  it('erro do servidor aparece; a sessão lista as rolagens anteriores', async () => {
    calls.rollsPost
      .mockResolvedValueOnce(serverRoll())
      .mockResolvedValueOnce(
        serverRoll({ id: 'r2', text: 'Falha', total: 0, outcome: 'failure' })
      )
      .mockResolvedValueOnce(
        fail(429, 'muitas rolagens seguidas; tente de novo em instantes')
      )
    await open()
    pick('Atributo', 'des', /^Destreza, 2/)
    for (let i = 0; i < 3; i++)
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
      })
    expect(
      screen.getByText('muitas rolagens seguidas; tente de novo em instantes')
    ).toBeTruthy()
    expect(screen.getByText('Falha')).toBeTruthy()
    expect(screen.getByText('Nesta sessão')).toBeTruthy()
  })

  it('busca sem acento acha Disciplina e a especialização liga o 10 duplo', async () => {
    calls.rollsPost.mockResolvedValue(serverRoll())
    await open()
    pick('Atributo', 'intel', /^Inteligência, 4/)
    pick('Habilidade ou Disciplina', 'taumaturgia', /^Taumaturgia, 3/)
    fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Usar especialização (10 conta 2 sucessos)',
      })
    )
    expect(screen.getByText('Especialização: 10 conta 2 sucessos')).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
    })
    expect(calls.rollsPost).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({
        slots: { attribute: 'intelligence', ability: 'disciplines:d1' },
        specialty: true,
      })
    )
  })

  it('o slot opcional volta a "nenhum"; busca sem resultado avisa', async () => {
    await open()
    pick('Atributo', 'des', /^Destreza, 2/)
    pick('Habilidade ou Disciplina', 'esport', /^Esportes, 1/)
    fireEvent.press(
      screen.getByRole('button', { name: /^Habilidade ou Disciplina:/ })
    )
    fireEvent.press(screen.getByRole('button', { name: 'Nenhum' }))
    expect(
      screen.getByRole('button', {
        name: 'Habilidade ou Disciplina: nenhum (opcional)',
      })
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: /^Atributo:/ }))
    fireEvent.changeText(screen.getByLabelText('Buscar atributo'), 'xyz')
    expect(screen.getByText('Nada encontrado para “xyz”.')).toBeTruthy()
  })

  it('dificuldade muda pelo stepper', async () => {
    calls.rollsPost.mockResolvedValue(serverRoll())
    await open()
    pick('Atributo', 'des', /^Destreza, 2/)
    fireEvent(
      screen.getByRole('adjustable', { name: 'Dificuldade' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
    })
    expect(calls.rollsPost).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ difficulty: 7 })
    )
  })

  it('incapacitado: avisa e não rola', async () => {
    const helena = example('helena').sheet
    const out = {
      ...helena,
      values: {
        ...helena.values,
        health: { aggravated: 0, lethal: 7, bashing: 0 },
      },
    } as SheetData
    await open(storeFor(['owner'], out).store)
    pick('Atributo', 'des', /^Destreza, 2/)
    expect(screen.getByText('Incapacitado: não pode rolar')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rolar no app' })).toBeDisabled()
  })

  it('sem rede e sem FdV para pagar: o custo não sai e avisa', async () => {
    calls.rollsPost.mockRejectedValue(new TypeError('offline'))
    const { store } = storeFor()
    await open(store, faces(7, 7))
    pick('Atributo', 'des', /^Destreza, 2/)
    fireEvent.press(screen.getByRole('checkbox', { name: /^Gastar 1 Força/ }))
    // A FdV acabou em outro lugar antes de rolar
    act(() => {
      const s = store.getState()
      s.received(
        {
          ...s.snapshot,
          values: {
            ...s.snapshot.values,
            willpower: { current: 0, permanent: 7 },
          },
        },
        9
      )
    })
    expect(screen.getByText('Força de Vontade insuficiente')).toBeTruthy()
  })
})

describe('atalhos do template (Mago, v1)', () => {
  // Otto: Arete 2, Forças 3 (1 inativo); sem ferimento para a parada limpa
  const mage = () => {
    const sheet = sheetFor('otto', ['owner']).sheet
    return storeFor(
      ['owner'],
      {
        ...sheet,
        values: {
          ...sheet.values,
          health: { aggravated: 0, lethal: 0, bashing: 0 },
        },
      },
      'mta-m20'
    ).store
  }

  it('Conjurar efeito monta a parada de Arete e manda só o id do atalho', async () => {
    calls.rollsPost.mockResolvedValue(
      serverRoll({ label: 'Conjurar efeito: Arete', difficulty: 7 })
    )
    await open(mage())
    fireEvent.press(screen.getByRole('button', { name: 'Conjurar efeito' }))
    expect(
      screen.getByRole('button', { name: 'Conjurar efeito' })
    ).toBeSelected()
    expect(
      screen.getByRole('button', { name: /^Atributo: Arete, 2/ })
    ).toBeTruthy()
    expect(screen.getByTestId('preset-help')).toHaveTextContent(
      /Dificuldade: 3 \+ Esfera mais alta/
    )
    expect(screen.getByLabelText('Parada: 2 dados')).toBeTruthy()
    fireEvent(
      screen.getByRole('adjustable', { name: 'Dificuldade' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } }
    )
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
    })
    expect(calls.rollsPost).toHaveBeenCalledWith(ID, {
      clientRollId: '00000000-0000-4000-8000-000000000001',
      slots: { attribute: 'arete' },
      difficulty: 7,
      specialty: false,
      boosts: [],
      preset: 'magick',
    })
  })

  it('trocar o slot fixado desliga o atalho; a Esfera inativa avisa', async () => {
    await open(mage())
    fireEvent.press(screen.getByRole('button', { name: 'Conjurar efeito' }))
    pick('Atributo', 'for', /^Forças, 2, 1 inativo, máx\. pelo Arete 2/)
    expect(
      screen.getByRole('button', { name: 'Conjurar efeito' })
    ).not.toBeSelected()
    expect(screen.queryByTestId('preset-help')).toBeNull()
    expect(
      screen.getByLabelText(
        'Parada: 2 dados. Forças: 1 inativo, máx. pelo Arete 2'
      )
    ).toBeTruthy()
  })

  it('o Vampiro não tem atalhos', async () => {
    await open()
    expect(screen.queryByTestId('dice-presets')).toBeNull()
  })
})

describe('o sheet Dados do Lobisomem (v2)', () => {
  const werewolf = (values: SheetData['values']) => {
    const { sheet } = sheetFor('iara', ['owner'])
    return storeFor(
      ['owner'],
      { ...sheet, values: { ...sheet.values, ...values } },
      'wta-w20'
    ).store
  }

  it('Força + Briga em Crinos: a parada usa o efetivo e diz a origem', async () => {
    calls.rollsPost.mockResolvedValue(
      serverRoll({ label: 'Força + Briga', dice: 9 })
    )
    await open(werewolf({ form: 'crinos' }))
    pick('Atributo', 'for', /^Força, 7, Crinos \+4/)
    pick('Habilidade', 'brig', /^Briga, 2/)
    expect(
      screen.getByLabelText('Parada: 9 dados. Força: Crinos +4')
    ).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
    })
    // O servidor resolve a forma pela ficha dele: só os slots vão
    expect(calls.rollsPost).toHaveBeenCalledWith(ID, {
      clientRollId: '00000000-0000-4000-8000-000000000001',
      slots: { attribute: 'strength', ability: 'brawl' },
      difficulty: 6,
      specialty: false,
      boosts: [],
    })
  })

  it('Teste de Fúria usa o permanente, mesmo sem Fúria para gastar', async () => {
    await open(werewolf({ rage: { current: 0, permanent: 4 } }))
    fireEvent.press(screen.getByRole('button', { name: 'Teste de Fúria' }))
    expect(
      screen.getByRole('button', { name: /^Atributo: Fúria/ })
    ).toBeTruthy()
    expect(screen.getByLabelText('Parada: 4 dados')).toBeTruthy()
    expect(screen.getByTestId('preset-help')).toHaveTextContent(
      'Parada de Fúria permanente.'
    )
  })
})

describe('quem vê os Dados', () => {
  it('sem papel na ficha, não rola (fail secure)', async () => {
    renderWithSession(
      <DiceButton characterId={ID} store={storeFor([]).store} />,
      await signedIn()
    )
    expect(screen.queryByRole('button', { name: 'Dados' })).toBeNull()
  })

  it('sistema sem pool-success não oferece Dados (D&D)', async () => {
    const lia = example('lia')
    renderWithSession(
      <DiceButton
        characterId={ID}
        store={storeFor(['owner'], lia.sheet, lia.system).store}
      />,
      await signedIn()
    )
    expect(screen.queryByRole('button', { name: /Dados|Teste/ })).toBeNull()
  })

  it('o narrador rola', async () => {
    await open(storeFor(['storyteller']).store)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Rolar no app' })).toBeTruthy()
    )
  })
})

describe('busca sem acento', () => {
  it.each([
    ['ocultismo', 'Ocultismo'],
    ['forca', 'Força'],
    ['TAUM', 'Taumaturgia'],
    ['  raciocinio ', 'Raciocínio'],
  ])('%s acha %s', (query, label) => {
    expect(matches(label, query)).toBe(true)
  })

  it('normaliza', () => {
    expect(fold('Ação Rápida')).toBe('acao rapida')
    expect(matches('Destreza', 'esp')).toBe(false)
  })
})
