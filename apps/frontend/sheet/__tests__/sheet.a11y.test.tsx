import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { RoleName } from '@tms/sheet-core'
import { useRouter } from 'expo-router'
import { AccessibilityInfo, Platform } from 'react-native'

import * as apiModule from '../../lib/api'
import { type createFakeApi, ok } from '../../test/fake-api'
import { modelOf, sheetFor, templateJson } from '../../test/fixtures'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import { CharacterForm } from '../CharacterForm'
import { RadioChips } from '../creation/RadioChips'
import { DiceButton } from '../dice/DiceButton'
import { SheetScreen } from '../SheetScreen'
import { createSheetStore } from '../store/sheetStore'

// Acessibilidade da ficha (P06 da onda 1): um teste de regressão por bug.

jest.mock('../../lib/api', () => {
  const { createFakeApi } = require('../../test/fake-api')
  const fake = createFakeApi()
  return { ...jest.requireActual('../../lib/api'), api: fake.api, fake }
})
jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-0000000000aa',
}))
const calls = (
  apiModule as unknown as { fake: ReturnType<typeof createFakeApi> }
).fake.calls

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => setOS(realOS))

beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => undefined)
  jest.mocked(useRouter).mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  } as never)
})

const keyDown = (key: string) => ({
  nativeEvent: { key, repeat: false },
  preventDefault: jest.fn(),
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

const form = (system: string) =>
  render(
    <CharacterForm
      model={modelOf(system)}
      onSubmit={jest.fn()}
      serverIssues={[]}
    />
  )

describe('Nova ficha: título visível nos grupos de escolha (T-09)', () => {
  it('Vampiro: "Clã" acima da grade; o Clã continua opcional', () => {
    form('vtm-v20')
    expect(screen.getByText('Clã')).toBeTruthy()
    expect(screen.getByLabelText('Clã')).toBeTruthy()
    expect(screen.queryByText(/Clã.*obrigatório/)).toBeNull()
  })

  it('Lobisomem: "Raça", "Augúrio" e "Tribo"', () => {
    form('wta-w20')
    for (const title of ['Raça', 'Augúrio', 'Tribo']) {
      expect(screen.getByText(title)).toBeTruthy()
    }
  })
})

describe('Prioridades no web: setas só movem o foco (T-35)', () => {
  it('a seta não grava a prioridade; o Espaço grava', () => {
    setOS('web')
    const onChange = jest.fn()
    render(
      <RadioChips
        label="Físicos"
        value="primary"
        onChange={onChange}
        options={[
          { id: 'primary', label: '7' },
          { id: 'secondary', label: '5' },
          { id: 'tertiary', label: '3' },
        ]}
      />
    )
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.props.tabIndex)).toEqual([0, -1, -1])
    fireEvent(
      screen.getByRole('radio', { name: '7' }),
      'keyDown',
      keyDown('ArrowRight')
    )
    expect(onChange).not.toHaveBeenCalled()
    fireEvent(screen.getByRole('radio', { name: '5' }), 'keyDown', keyDown(' '))
    expect(onChange).toHaveBeenCalledWith('secondary')
  })
})

// --- T-42: o estado do controle de sigilo é anunciado e inequívoco ---

const ID = '00000000-0000-4000-8000-00000000c001'
const NPC = '00000000-0000-4000-8000-00000000c009'

function diceStore(roles: RoleName[]) {
  return createSheetStore({
    characterId: ID,
    model: modelOf('vtm-v20'),
    sheet: sheetFor('helena', roles).sheet,
    sheetVersion: 3,
    roles,
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-00000000b001',
  })
}

const serverRoll = () =>
  ok({
    duplicate: false,
    sheetVersion: 3,
    sheet: sheetFor('helena', ['storyteller']).sheet,
    roll: {
      id: 'r1',
      at: '2026-10-18T12:00:00Z',
      by: { username: 'ana' },
      byRole: 'storyteller',
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
    },
  })

async function rollAsStoryteller(hidden: boolean) {
  calls.rollsPost.mockResolvedValue(serverRoll())
  let n = 0
  renderWithSession(
    <DiceButton
      characterId={ID}
      store={diceStore(['storyteller'])}
      uuid={() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`}
    />,
    await signedIn()
  )
  fireEvent.press(screen.getByRole('button', { name: 'Dados' }))
  const secret = screen.getByRole('switch', { name: 'Rolagem oculta' })
  expect(secret).not.toBeChecked()
  if (hidden) {
    fireEvent.press(secret)
    expect(screen.getByRole('switch', { name: 'Rolagem oculta' })).toBeChecked()
  }
  for (const [slot, query, option] of [
    ['Atributo', 'des', /^Destreza, 2/],
    ['Habilidade ou Disciplina', 'esport', /^Esportes, 1/],
  ] as const) {
    fireEvent.press(
      screen.getByRole('button', { name: new RegExp(`^${slot}:`) })
    )
    fireEvent.changeText(
      screen.getByLabelText(`Buscar ${slot.toLowerCase()}`),
      query
    )
    fireEvent.press(screen.getByRole('button', { name: option }))
  }
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Rolar no app' }))
  })
  return calls.rollsPost.mock.calls.at(-1)?.[1] as Record<string, unknown>
}

describe('Dados do narrador: "Rolagem oculta" é um interruptor (T-42)', () => {
  it('ligado: anunciado como marcado, e o pedido leva hidden: true', async () => {
    expect(await rollAsStoryteller(true)).toMatchObject({ hidden: true })
  })

  it('desligado: o pedido leva hidden: false', async () => {
    expect(await rollAsStoryteller(false)).toMatchObject({ hidden: false })
  })
})

const npcAsStoryteller = (visibility: 'hidden' | 'identity' | 'full') =>
  ok({
    projection: 'full',
    id: NPC,
    kind: 'npc',
    visibility,
    visibilityRevision: 2,
    presentationRevision: 0,
    identity: {
      name: 'Oráculo',
      chip: null,
      subtitle: null,
      portraitUrl: null,
    },
    name: 'Oráculo',
    chronicle: { id: 'c1', name: 'Crônica de teste' },
    owner: { id: 'u1', username: 'ana' },
    systemCode: 'vtm-v20',
    templateVersion: '1.0.0',
    sheetVersion: 3,
    roles: ['storyteller'],
    status: 'active',
    lockedAt: null,
    member: true,
    updatedAt: '2026-10-18T12:00:00Z',
    sheet: sheetFor('helena', ['storyteller']).sheet,
  })

async function openNpc() {
  calls.characterGet.mockResolvedValue(npcAsStoryteller('hidden'))
  calls.templateGet.mockResolvedValue(ok(templateJson('vtm-v20')))
  renderWithSession(<SheetScreen id={NPC} />, await signedIn())
  return screen.findByRole('radio', { name: 'Oculto' }, { timeout: 5000 })
}

describe('Visibilidade do NPC: rádio marcado, não botão desabilitado (T-42)', () => {
  it('três rádios, "Oculto" marcado e não desabilitado', async () => {
    const hidden = await openNpc()
    expect(hidden).toBeChecked()
    expect(hidden).not.toBeDisabled()
    expect(
      screen.getAllByRole('radio', { name: /^(Oculto|Identidade|Ficha)/ })
    ).toHaveLength(3)
    expect(screen.getByText('Visibilidade do NPC')).toBeTruthy()
  })

  it('"Identidade" chama a mutação uma vez, com a chave de idempotência', async () => {
    let resolve: (value: unknown) => void = () => undefined
    calls.visibilityPost.mockImplementation(
      () =>
        new Promise(r => {
          resolve = r
        })
    )
    await openNpc()
    fireEvent.press(screen.getByRole('radio', { name: /^Identidade/ }))
    // Com o pedido pendente, as opções ficam desabilitadas
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /^Ficha/ })).toBeDisabled()
    )
    fireEvent.press(screen.getByRole('radio', { name: /^Ficha/ }))
    expect(calls.visibilityPost).toHaveBeenCalledTimes(1)
    expect(calls.visibilityPost).toHaveBeenCalledWith(NPC, {
      visibility: 'identity',
      revision: 2,
      clientCommandId: '00000000-0000-4000-8000-0000000000aa',
    })
    await act(async () => {
      resolve(ok({ visibility: 'identity', visibilityRevision: 3 }))
    })
  })

  it('tocar na opção atual não chama a API', async () => {
    const hidden = await openNpc()
    fireEvent.press(hidden)
    expect(calls.visibilityPost).not.toHaveBeenCalled()
  })

  it('no web, a seta não revela o NPC', async () => {
    setOS('web')
    const hidden = await openNpc()
    fireEvent(hidden, 'keyDown', keyDown('ArrowDown'))
    expect(calls.visibilityPost).not.toHaveBeenCalled()
  })
})
