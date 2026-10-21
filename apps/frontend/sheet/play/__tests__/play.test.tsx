import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import {
  compileTemplate,
  type RoleName,
  type SheetData,
  type SheetMode,
  type SheetModel,
} from '@tms/sheet-core'
import { ToastProvider } from '@tms/ui'
import * as Haptics from 'expo-haptics'
import { AccessibilityInfo, Dimensions } from 'react-native'
import {
  example,
  modelOf,
  sheetFor,
  templateJson,
} from '../../../test/fixtures'
import { defaultMode } from '../../SheetScreen'
import { SheetView } from '../../SheetView'
import { createSheetStore } from '../../store/sheetStore'
import type { QueuedBatch } from '../../sync/outbox'

// Etapa 17: o modo Jogo. Dock (toque abre, toque longo aplica a ação padrão),
// sheets de recurso e de trilha, ações com prévia e o porquê de um campo não
// mexer em Jogo. Tudo pelo store da Etapa 16: otimista, fila e Desfazer.

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Warning: 'warning' },
}))

const vtm = modelOf('vtm-v20')
const PHONE = { width: 390, height: 844, scale: 3, fontScale: 1 }
const TABLET = { width: 750, height: 1334, scale: 2, fontScale: 1 }

beforeEach(() => {
  // O dock é do celular (compact); a partir de 600 vira a seção "Em jogo"
  Dimensions.set({ window: PHONE, screen: PHONE })
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
})
afterEach(() => {
  Dimensions.set({ window: TABLET, screen: TABLET })
})

function setup(
  sheet: SheetData,
  {
    model = vtm,
    roles = ['owner'],
    mode = 'play',
  }: {
    readonly model?: SheetModel
    readonly roles?: RoleName[]
    readonly mode?: SheetMode
  } = {}
) {
  const enqueue = jest.fn()
  let n = 0
  const store = createSheetStore({
    characterId: 'c1',
    model,
    sheet,
    sheetVersion: 1,
    roles,
    mode,
    sync: { enqueue },
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  })
  render(
    <ToastProvider>
      <SheetView store={store} />
    </ToastProvider>
  )
  const batches = () => enqueue.mock.calls.map(c => c[1] as QueuedBatch)
  return { store, batches }
}

const helena = () => sheetFor('helena', ['owner']).sheet
const withValues = (
  values: Record<string, unknown>,
  base = helena()
): SheetData =>
  ({ ...base, values: { ...base.values, ...values } }) as SheetData
// Recém-criada, 13ª geração: Sangue cheio, 10 de 10
const fresh = (): SheetData => ({
  values: { name: 'Nova', blood: { current: 10 } },
  specialties: {},
})
const announced = () =>
  jest
    .mocked(AccessibilityInfo.announceForAccessibility)
    .mock.calls.map(c => c[0])

describe('CombatDock', () => {
  it('toque longo no Sangue: lote de {current: 10} para {current: 9}, com Desfazer', async () => {
    const { batches } = setup(fresh())
    const chip = screen.getByRole('button', {
      name: 'Pontos de Sangue, 10 de 10. Toque longo: Gastar 1 Sangue',
    })
    fireEvent(chip, 'longPress')
    expect(batches()).toEqual([
      {
        clientBatchId: expect.any(String),
        events: [
          {
            path: 'values.blood',
            from: { current: 10 },
            to: { current: 9 },
          },
        ],
        label: 'Sangue 10 → 9',
      },
    ])
    // O chip mostra o otimista na hora, e o leitor de tela ouve o aviso
    expect(
      screen.getByRole('button', { name: /^Pontos de Sangue, 9 de 10\./ })
    ).toBeTruthy()
    expect(announced()).toContain('Sangue 10 → 9')
    await waitFor(() => expect(Haptics.impactAsync).toHaveBeenCalled())

    fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
    expect(batches()[1]).toMatchObject({
      events: [
        { path: 'values.blood', from: { current: 9 }, to: { current: 10 } },
      ],
      label: 'Desfeito: Sangue 10 → 9',
    })
    expect(
      screen.getByRole('button', { name: /^Pontos de Sangue, 10 de 10\./ })
    ).toBeTruthy()
  })

  it('a ação padrão também está nas ações de acessibilidade', () => {
    const { batches } = setup(fresh())
    const chip = screen.getByTestId('dock-blood')
    expect(chip.props.accessibilityActions).toEqual([
      { name: 'activate' },
      { name: 'longpress', label: 'Gastar 1 Sangue' },
    ])
    fireEvent(chip, 'accessibilityAction', {
      nativeEvent: { actionName: 'longpress' },
    })
    expect(batches()).toHaveLength(1)
    fireEvent(chip, 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    })
    expect(
      screen.getByRole('header', { name: 'Pontos de Sangue' })
    ).toBeTruthy()
  })

  it('sem Sangue, o toque longo explica e não grava nada', () => {
    const { batches } = setup(withValues({ blood: { current: 0 } }))
    const chip = screen.getByTestId('dock-blood')
    // Sem saldo, a ação some da acessibilidade
    expect(chip.props.accessibilityActions).toEqual([{ name: 'activate' }])
    fireEvent(chip, 'longPress')
    expect(batches()).toEqual([])
    expect(screen.getByText('Sem Sangue para gastar')).toBeTruthy()
  })

  it('a Vitalidade (sem ação padrão) só abre o sheet', () => {
    const { batches } = setup(helena())
    const chip = screen.getByTestId('dock-health')
    expect(chip.props.accessibilityLabel).toBe(
      'Vitalidade: Machucado, penalidade menos 1; 1 letal, 1 contusivo'
    )
    fireEvent(chip, 'longPress')
    expect(batches()).toEqual([])
  })

  it('"Todos os recursos" mostra a zona Em jogo inteira', () => {
    setup(helena())
    // No celular, a seção "Em jogo" vira o dock
    expect(screen.queryByText('Em jogo')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Todos os recursos' }))
    expect(
      screen.getByRole('header', { name: 'Todos os recursos' })
    ).toBeTruthy()
    // A linha (sem o "Toque longo" do chip do dock)
    fireEvent.press(
      screen.getByRole('button', {
        name: 'Força de Vontade, 5 de 7, permanente 7',
      })
    )
    expect(
      screen.getByRole('header', { name: 'Força de Vontade' })
    ).toBeTruthy()
  })

  it('a partir de 600, sem dock: a seção Em jogo tem os mesmos campos', () => {
    Dimensions.set({ window: TABLET, screen: TABLET })
    setup(helena())
    expect(screen.queryByTestId('dock-blood')).toBeNull()
    expect(screen.getByText('Em jogo')).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Pontos de Sangue, 9 de 15' })
    )
    expect(
      screen.getByRole('header', { name: 'Pontos de Sangue' })
    ).toBeTruthy()
  })
})

describe('sheet da Vitalidade (wod-stacking)', () => {
  const increment = (name: string) =>
    fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    })

  it('+1 letal pelo stepper da linha do tipo', async () => {
    const { batches } = setup(helena())
    fireEvent.press(screen.getByTestId('dock-health'))
    expect(screen.getByRole('header', { name: 'Vitalidade' })).toBeTruthy()
    increment('Dano letal')
    expect(batches()).toEqual([
      expect.objectContaining({
        events: [
          {
            path: 'values.health',
            from: { aggravated: 0, lethal: 1, bashing: 1 },
            to: { aggravated: 0, lethal: 2, bashing: 1 },
          },
        ],
        label: 'Vitalidade · +1 nível letal',
      }),
    ])
    expect(announced()).toContain('Vitalidade · +1 nível letal')
    await waitFor(() => expect(Haptics.selectionAsync).toHaveBeenCalled())
    // − cura o mesmo tipo
    fireEvent(
      screen.getByRole('adjustable', { name: 'Dano contusivo' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } }
    )
    expect(batches()[1]?.label).toBe('Vitalidade · Curou 1 nível contusivo')
  })

  it('agravado pede o háptico mais forte', async () => {
    setup(helena())
    fireEvent.press(screen.getByTestId('dock-health'))
    increment('Dano agravado')
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalled())
  })

  it('trilha cheia: a nota da regra vai para o aviso', () => {
    const { batches } = setup(
      withValues({ health: { aggravated: 0, lethal: 0, bashing: 7 } })
    )
    fireEvent.press(screen.getByTestId('dock-health'))
    increment('Dano contusivo')
    expect(batches()[0]?.events[0]?.to).toEqual({
      aggravated: 0,
      lethal: 1,
      bashing: 6,
    })
    expect(announced()).toContain(
      'Vitalidade · Trilha cheia: contusivo a mais virou letal'
    )
  })

  it('trilha cheia de letal: + letal explica e não grava nada', () => {
    const { batches } = setup(
      withValues({ health: { aggravated: 0, lethal: 7, bashing: 0 } })
    )
    fireEvent.press(screen.getByTestId('dock-health'))
    increment('Dano letal')
    expect(batches()).toEqual([])
    expect(announced()).toContain(
      'Vitalidade · Vitalidade cheia: letal não muda a trilha'
    )
  })

  it('incapacitado: o chip e o sheet dizem, e a parada fica bloqueada', () => {
    setup(withValues({ health: { aggravated: 2, lethal: 3, bashing: 2 } }))
    expect(screen.getByTestId('dock-health').props.accessibilityLabel).toMatch(
      /^Vitalidade: Incapacitado, penalidade incapacitado;/
    )
    expect(screen.getByText('Incapacitado')).toBeTruthy()
    fireEvent.press(screen.getByTestId('dock-health'))
    expect(
      screen.getByText(
        'Não pode agir. A parada de dados fica bloqueada até curar.'
      )
    ).toBeTruthy()
  })
})

describe('sheet do Sangue', () => {
  it('Curar: a prévia antes, depois um lote com a Vitalidade e o Sangue', () => {
    const { batches } = setup(helena())
    fireEvent.press(screen.getByTestId('dock-blood'))
    fireEvent.press(
      screen.getByRole('button', { name: 'Curar 1 nível de dano (1 Sangue)' })
    )
    expect(screen.getByText('Vitalidade: −1 letal')).toBeTruthy()
    expect(screen.getByText('Sangue: 9 → 8')).toBeTruthy()
    expect(batches()).toEqual([])
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(batches()).toEqual([
      expect.objectContaining({
        events: [
          {
            path: 'values.health',
            from: { aggravated: 0, lethal: 1, bashing: 1 },
            to: { aggravated: 0, lethal: 0, bashing: 1 },
          },
          {
            path: 'values.blood',
            from: { current: 9 },
            to: { current: 8 },
          },
        ],
        label: 'Curou 1 nível letal (1 Sangue)',
      }),
    ])
  })

  it('Voltar da prévia não grava; sem dano, Curar fica indisponível', () => {
    const { batches } = setup(
      withValues({ health: { aggravated: 1, lethal: 0, bashing: 0 } })
    )
    fireEvent.press(screen.getByTestId('dock-blood'))
    const heal = screen.getByRole('button', {
      name: 'Curar 1 nível de dano (1 Sangue)',
    })
    expect(
      heal.props.accessibilityState?.disabled ?? heal.props['aria-disabled']
    ).toBe(true)
    // O agravado não se cura com Sangue nesta ação
    expect(screen.getByText('Nada a curar com este recurso')).toBeTruthy()
    expect(batches()).toEqual([])
  })

  it('gastar e recuperar com os verbos do template, e o stepper do atual', () => {
    const { batches } = setup(helena())
    fireEvent.press(screen.getByTestId('dock-blood'))
    fireEvent.press(screen.getByRole('button', { name: 'Gastar 1' }))
    fireEvent.press(screen.getByRole('button', { name: 'Recuperar 1' }))
    fireEvent(
      screen.getByRole('adjustable', { name: 'Sangue atual' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } }
    )
    expect(batches().map(b => b.label)).toEqual([
      'Sangue 9 → 8',
      'Sangue 8 → 9',
      'Sangue 9 → 8',
    ])
    expect(screen.getByText('Gasto máximo por turno: 3')).toBeTruthy()
  })

  it('FdV: o permanente só muda em Editar', () => {
    setup(helena())
    fireEvent.press(screen.getByTestId('dock-willpower'))
    expect(screen.getByText('Permanente 7 · muda só em Editar')).toBeTruthy()
  })
})

describe('menu ⋯: ações do template', () => {
  it('Despertar mostra a prévia antes de aplicar', () => {
    const { batches } = setup(helena())
    fireEvent.press(screen.getByRole('button', { name: 'Ações da ficha' }))
    expect(
      screen.getByText(
        'Gasta 1 ponto de Sangue para despertar. Mostra a prévia antes de aplicar.'
      )
    ).toBeTruthy()
    fireEvent.press(
      screen.getByRole('button', { name: 'Despertar (nova noite)' })
    )
    expect(screen.getByText('Sangue: 9 → 8')).toBeTruthy()
    expect(batches()).toEqual([])
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    fireEvent.press(
      screen.getByRole('button', { name: 'Despertar (nova noite)' })
    )
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(batches()).toEqual([
      expect.objectContaining({
        events: [
          { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
        ],
        label: 'Despertar (nova noite)',
      }),
    ])
    // O sheet fecha: o aviso com Desfazer fica à vista
    expect(screen.queryByText('Prévia')).toBeNull()
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeTruthy()
  })

  it('sem Sangue, Despertar fica indisponível com o porquê', () => {
    setup(withValues({ blood: { current: 0 } }))
    fireEvent.press(screen.getByRole('button', { name: 'Ações da ficha' }))
    expect(screen.getByText('Sem pontos de sangue para gastar')).toBeTruthy()
  })

  it('Regenerar (Lobisomem): cura 1 letal sem custo, com a prévia', () => {
    const taina = example('taina')
    const { batches } = setup(taina.sheet, { model: modelOf(taina.system) })
    fireEvent.press(screen.getByRole('button', { name: 'Ações da ficha' }))
    expect(
      screen.getByText(
        'Cura 1 nível contusivo ou letal, letal primeiro. O agravado fica.'
      )
    ).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Regenerar 1 nível' }))
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(batches()).toEqual([
      expect.objectContaining({
        events: [
          {
            path: 'values.health',
            from: { bashing: 1, lethal: 2, aggravated: 1 },
            to: { aggravated: 1, lethal: 1, bashing: 1 },
          },
        ],
      }),
    ])
  })

  it('Regenerar só com agravado fica indisponível com o porquê', () => {
    const taina = example('taina')
    setup(
      {
        ...taina.sheet,
        values: {
          ...taina.sheet.values,
          health: { aggravated: 1, lethal: 0, bashing: 0 },
        },
      },
      { model: modelOf(taina.system) }
    )
    fireEvent.press(screen.getByRole('button', { name: 'Ações da ficha' }))
    expect(
      screen.getByText('Nada a curar: sem dano contusivo ou letal')
    ).toBeTruthy()
  })

  it('template sem ação desta versão: o ⋯ some (D&D)', () => {
    const lia = example('lia')
    setup(lia.sheet, { model: modelOf(lia.system) })
    expect(screen.queryByRole('button', { name: 'Ações da ficha' })).toBeNull()
  })
})

describe('o que muda em Jogo', () => {
  it('a Força não ganha stepper: o detalhe diz que muda em Editar', () => {
    setup(helena())
    fireEvent.press(screen.getByRole('button', { name: 'Força, 2 de 5' }))
    expect(screen.getByRole('header', { name: 'Força' })).toBeTruthy()
    expect(
      screen.getByText('Traço permanente: muda só em Editar.')
    ).toBeTruthy()
    expect(screen.queryByRole('adjustable')).toBeNull()
  })

  it('o dono abre em Jogo; o narrador, em Leitura', () => {
    expect(defaultMode(['owner'])).toBe('play')
    expect(defaultMode(['owner', 'storyteller'])).toBe('play')
    expect(defaultMode(['storyteller'])).toBe('read')
  })

  it('Dados ficam na barra de Jogo, ao lado do ⋯', () => {
    setup(helena())
    expect(screen.getByRole('button', { name: 'Dados' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ações da ficha' })).toBeTruthy()
  })

  it('em Leitura não há Dados', () => {
    setup(helena(), { roles: ['storyteller'], mode: 'read' })
    expect(screen.queryByRole('button', { name: 'Dados' })).toBeNull()
  })

  it('template sem rolagem (D&D) não mostra Dados, com o mesmo código', () => {
    const lia = example('lia')
    setup(lia.sheet, { model: modelOf(lia.system) })
    expect(screen.queryByRole('button', { name: 'Dados' })).toBeNull()
  })

  it('em Leitura: sem dock, sem ⋯ e o sheet só mostra', () => {
    setup(helena(), { roles: ['storyteller'], mode: 'read' })
    expect(screen.queryByTestId('dock-blood')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ações da ficha' })).toBeNull()
    fireEvent.press(
      screen.getByRole('button', { name: 'Pontos de Sangue, 9 de 15' })
    )
    expect(screen.getByText('Somente leitura neste modo.')).toBeTruthy()
    expect(screen.queryByRole('adjustable')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gastar 1' })).toBeNull()
  })

  it('quem não escreve não ganha controle, mesmo em Jogo', () => {
    // O dock numa seção que o dono lê e só o narrador escreve
    const t = templateJson('vtm-v20')
    t.templateVersion = '9.9.0'
    for (const s of t.sections as { id: string; permissions?: unknown }[])
      if (s.id === 'play') s.permissions = { write: ['storyteller'] }
    setup(helena(), { model: compileTemplate(t), mode: 'play' })
    fireEvent.press(screen.getByTestId('dock-blood'))
    expect(screen.getByText('Você não pode alterar este campo.')).toBeTruthy()
    expect(screen.queryByRole('adjustable')).toBeNull()
  })

  it('o sheet de um campo derivado diz que é calculado (D&D)', () => {
    const lia = example('lia')
    const model = modelOf(lia.system)
    setup(lia.sheet, { model })
    const powers = model.zones.find(z => z.id === 'powers')?.label ?? ''
    fireEvent.press(screen.getByRole('tab', { name: powers }))
    fireEvent.press(
      screen.getByRole('button', { name: /^Bônus de proficiência/ })
    )
    expect(screen.getByText('Calculado pela ficha.')).toBeTruthy()
  })
})

describe('outros sistemas com o mesmo código', () => {
  it('D&D: PV com temporários primeiro, CA e espaços de magia', () => {
    const lia = example('lia')
    const { batches } = setup(lia.sheet, { model: modelOf(lia.system) })
    fireEvent(screen.getByTestId('dock-hp'), 'longPress')
    expect(batches()[0]).toMatchObject({
      events: [
        {
          path: 'values.hp',
          from: { current: 27, max: 27, temp: 5 },
          to: { current: 27, max: 27, temp: 4 },
        },
      ],
      label: 'PV temporários 5 → 4',
    })
    // CA não tem ação padrão: o toque longo não faz nada
    fireEvent(screen.getByTestId('dock-ac'), 'longPress')
    expect(batches()).toHaveLength(1)
    fireEvent(screen.getByTestId('dock-spellSlots'), 'longPress')
    expect(batches()[1]?.label).toBe('Usou 1 espaço de 1º nível')
    expect(screen.getByTestId('dock-ac').props.accessibilityLabel).toMatch(
      /^Classe de Armadura/
    )
  })

  it('Fate: as caixas do Estresse alternam no sheet', () => {
    const dandara = example('dandara')
    const { batches } = setup(dandara.sheet, {
      model: modelOf(dandara.system),
    })
    fireEvent.press(screen.getByTestId('dock-stress'))
    const box = screen.getByRole('checkbox', {
      name: 'Físico, caixa 1 (vale 1)',
    })
    expect(box).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Físico, caixa 2 (vale 2)' })
    ).toBeChecked()
    fireEvent.press(box)
    expect(batches()[0]?.events[0]).toEqual({
      path: 'values.stress',
      from: { physical: [false, true, false], mental: [false, false] },
      to: { physical: [true, true, false], mental: [false, false] },
    })
    expect(
      screen.getByRole('checkbox', { name: 'Físico, caixa 1 (vale 1)' })
    ).toBeChecked()
  })

  it.each(['tomas', 'iara', 'joana'])(
    '%s: o dock abre e cada chip tem nome',
    id => {
      const c = example(id)
      const model = modelOf(c.system)
      setup(c.sheet, { model })
      for (const field of model.template.dock) {
        const chip = screen.getByTestId(`dock-${field}`)
        expect(chip.props.accessibilityLabel).toBeTruthy()
        fireEvent.press(chip)
        expect(
          screen.getByRole('header', {
            name: model.fields.get(field)?.def.label ?? '',
          })
        ).toBeTruthy()
        fireEvent.press(
          screen.getAllByRole('button', { name: 'Fechar' })[0] as never
        )
      }
    }
  )
})
