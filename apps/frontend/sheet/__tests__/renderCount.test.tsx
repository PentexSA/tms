import { act, render, screen } from '@testing-library/react-native'
import { effectiveCreationConfig } from '@tms/sheet-core'
import { modelOf, sheetFor } from '../../test/fixtures'
import * as advice from '../creation/useStepAdvice'
import { SheetView } from '../SheetView'
import { createSheetStore } from '../store/sheetStore'
import * as views from '../views'

// Etapa 16, assinatura por campo (doc/arquitetura §6.5): com dezenas de
// campos na tela, gastar Sangue re-renderiza só quem assina o Sangue.

jest.mock('../views', () =>
  require('../../test/countViews').countingViews(jest.requireActual('../views'))
)
const renders = (views as unknown as { renders: Map<string, number> }).renders

// A previsão do "+" (P05-C) conta os renders das linhas da Criação: cada
// render de um editor numérico lê a previsão do próprio caminho uma vez
jest.mock('../creation/useStepAdvice', () => {
  const actual = jest.requireActual('../creation/useStepAdvice')
  const reads = new Map<string, number>()
  return {
    reads,
    useStepAdvice: (path: string) => {
      reads.set(path, (reads.get(path) ?? 0) + 1)
      return actual.useStepAdvice(path)
    },
  }
})
const reads = (advice as unknown as { reads: Map<string, number> }).reads

it('gastar Sangue re-renderiza só o Sangue', () => {
  const { model, sheet } = sheetFor('helena', ['owner'])
  const store = createSheetStore({
    characterId: 'c1',
    model,
    sheet,
    sheetVersion: 1,
    roles: ['owner'],
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-000000000001',
  })
  // Duas fichas do mesmo store (a do celular e uma prévia). As Habilidades
  // com o filtro ligado viram chips (ChipFlow, memo por campo), fora da
  // contagem do registry: sobram ~30 FieldSlot, e nenhum re-renderiza
  render(
    <>
      <SheetView store={store} />
      <SheetView store={store} />
    </>
  )
  const total = [...renders.values()].reduce((a, b) => a + b, 0)
  expect(total).toBeGreaterThanOrEqual(30)
  renders.clear()

  act(() => {
    store
      .getState()
      .commit(
        [{ path: 'values.blood', from: { current: 9 }, to: { current: 8 } }],
        'Sangue −1'
      )
  })
  expect(screen.getAllByLabelText(/^Pontos de Sangue, 8 de/)).toHaveLength(2)
  expect([...renders.keys()]).toEqual(['blood'])
  expect(renders.get('blood')).toBe(2)
})

it('mexer na roda do Mago re-renderiza só a roda (v1)', () => {
  const { model, sheet } = sheetFor('tomas', ['owner'])
  const store = createSheetStore({
    characterId: 'c2',
    model,
    sheet,
    sheetVersion: 1,
    roles: ['owner'],
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-000000000002',
  })
  render(<SheetView store={store} />)
  renders.clear()

  act(() => {
    store.getState().commit(
      [
        {
          path: 'values.wheel',
          from: { quintessence: 6, paradox: 2 },
          to: { quintessence: 6, paradox: 3 },
        },
      ],
      'Paradoxo 2 → 3'
    )
  })
  expect([...renders.keys()]).toEqual(['wheel'])
})

it('trocar de forma re-renderiza a forma e os atributos que ela muda (v2)', () => {
  const { model, sheet } = sheetFor('iara', ['owner'])
  const store = createSheetStore({
    characterId: 'c3',
    model,
    sheet,
    sheetVersion: 1,
    roles: ['owner'],
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-000000000003',
  })
  render(<SheetView store={store} />)
  renders.clear()

  act(() => {
    store
      .getState()
      .commit(
        [{ path: 'values.form', from: 'hominideo', to: 'crinos' }],
        'Forma Hominídeo → Crinos'
      )
  })
  // Crinos mexe em For, Des, Vig, Man e Apa; a Vitalidade, a Fúria e a FdV
  // ficam de fora
  const changed = [...renders.keys()]
  expect(changed).toContain('form')
  for (const id of ['health', 'rage', 'gnosis', 'willpower', 'charisma'])
    expect(changed).not.toContain(id)
})

it('em Criação, um ponto em Força não re-renderiza as linhas das Habilidades (P05-C)', () => {
  const model = modelOf('vtm-v20')
  const store = createSheetStore({
    characterId: 'c4',
    model,
    sheet: { values: { name: 'Nova', clan: 'tremere' }, specialties: {} },
    sheetVersion: 1,
    roles: ['owner'],
    mode: 'create',
    sync: { enqueue: jest.fn() },
    uuid: () => '00000000-0000-4000-8000-000000000004',
    creation: {
      config: effectiveCreationConfig(model),
      choices: {
        priorities: {
          attributes: ['physical', 'social', 'mental'],
          abilities: ['talents', 'skills', 'knowledges'],
        },
      },
    },
  })
  store.getState().startDraft()
  render(<SheetView store={store} />)
  expect(reads.get('values.alertness')).toBeGreaterThan(0)
  reads.clear()

  act(() => {
    store.getState().setDraftValue('values.strength', 2)
  })
  // Só a Força (a previsão dela e o valor mudaram); nenhuma Habilidade
  expect(reads.get('values.strength')).toBeGreaterThan(0)
  for (const id of ['alertness', 'brawl', 'academics', 'stealth'])
    expect(reads.get(`values.${id}`)).toBeUndefined()
})
