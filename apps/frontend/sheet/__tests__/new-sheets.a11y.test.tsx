import { onlineManager } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable } from '@tms/ui'
import { Platform, StyleSheet, type ViewStyle } from 'react-native'

import { LogoutButton } from '../../components/session/LogoutButton'
import { modelOf, sheetFor } from '../../test/fixtures'
import { renderLive } from '../../test/live'
import {
  json,
  memoryStore,
  renderWithSession,
  testSession,
  tokens,
} from '../../test/session'
import { DraftRecovery } from '../DraftRecovery'
import { createSheetStore } from '../store/sheetStore'
import { createMemoryOutbox } from '../sync/outbox'
import type { PostOutcome } from '../sync/sender'

// P06 na integração da onda: as folhas novas do P02 (aviso de "Sair") e do
// P03-C (recuperação do rascunho e campos em conflito) herdam o BottomSheet
// (um "Fechar") e o Button (o alvo mínimo da plataforma). O alvo é
// comparado com o de um Pressable comum, para o teste não depender do
// número (o T-70 pode ser revertido sozinho).

const ID = '00000000-0000-4000-8000-00000000c001'

const realOS = Platform.OS
const setOS = (os: string) =>
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
afterEach(() => {
  setOS(realOS)
  onlineManager.setOnline(true)
})

async function signedIn() {
  const { session } = testSession(
    () => json(200, tokens()),
    memoryStore(true, 'r')
  )
  await session.restore()
  return session
}

const minHeightOf = (el: { props: { style?: unknown } }) =>
  (StyleSheet.flatten(el.props.style as ViewStyle) ?? {}).minHeight

/** O alvo mínimo de um Pressable comum, nesta plataforma. */
function platformTarget(): unknown {
  const reference = render(
    <Pressable accessibilityLabel="Referência" onPress={() => undefined} />
  )
  const height = minHeightOf(screen.getByLabelText('Referência'))
  reference.unmount()
  return height
}

/** Um "Fechar" só; cada botão da folha com nome e o alvo da plataforma. */
function expectSheetA11y(buttons: readonly string[], target: unknown) {
  expect(screen.getAllByRole('button', { name: 'Fechar' })).toHaveLength(1)
  for (const name of buttons)
    expect(minHeightOf(screen.getByRole('button', { name }))).toBe(target)
}

describe('Aviso de "Sair" (P02, LogoutButton)', () => {
  it.each(['ios', 'android'])(
    '%s: um Fechar, botões com nome e alvo da plataforma',
    async os => {
      setOS(os)
      const target = platformTarget()
      const outbox = createMemoryOutbox()
      await outbox.enqueue(ID, {
        clientBatchId: '00000000-0000-4000-8000-0000000000b1',
        label: 'Sangue −1',
        events: [
          { path: 'values.blood', from: { current: 9 }, to: { current: 8 } },
        ],
      })
      onlineManager.setOnline(false)
      renderWithSession(<LogoutButton />, await signedIn(), {
        outbox,
        post: async (): Promise<PostOutcome> => ({ status: 0, body: null }),
      })
      // A fila conta o que ficou no aparelho ao abrir
      await act(() => new Promise(r => setTimeout(r, 0)))
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
      })
      expect(
        await screen.findByRole('header', { name: 'Sair e descartar?' })
      ).toBeTruthy()
      expectSheetA11y(['Continuar conectado', 'Sair e descartar'], target)
    }
  )
})

describe('Recuperação do rascunho (P03-C, DraftRecovery)', () => {
  it.each(['ios', 'android'])(
    '%s: um Fechar, "Recuperar" e "Descartar" com nome e alvo da plataforma',
    async os => {
      setOS(os)
      const target = platformTarget()
      const model = modelOf('vtm-v20')
      const store = createSheetStore({
        characterId: ID,
        model,
        sheet: sheetFor('helena', ['owner']).sheet,
        sheetVersion: 3,
        roles: ['owner'],
        sync: { enqueue: jest.fn() },
        uuid: () => '00000000-0000-4000-8000-00000000b001',
      })
      const persistence = {
        offer: {
          v: 1 as const,
          characterId: ID,
          templateVersion: model.version,
          baseVersion: 3,
          mode: 'evolve' as const,
          savedAt: Date.now(),
          edits: [{ path: 'values.occult', from: 0, to: 1 }],
        },
        recover: jest.fn(() => null),
        discard: jest.fn(),
        later: jest.fn(),
      }
      renderWithSession(
        <DraftRecovery
          persistence={persistence}
          store={store}
          blocked={false}
        />,
        await signedIn()
      )
      expect(
        screen.getByRole('header', { name: 'Alterações não salvas' })
      ).toBeTruthy()
      expectSheetA11y(['Recuperar', 'Descartar'], target)
      // Fechar é "depois": o registro fica
      fireEvent.press(screen.getByRole('button', { name: 'Fechar' }))
      expect(persistence.later).toHaveBeenCalled()
    }
  )
})

describe('Campos em conflito (P03-C, ConflictSheet)', () => {
  it.each(['ios', 'android'])(
    '%s: os botões de cada campo dizem qual campo; um Fechar; alvo da plataforma',
    async os => {
      setOS(os)
      const target = platformTarget()
      const model = modelOf('vtm-v20')
      const helena = sheetFor('helena', ['owner']).sheet
      let sent = 0
      const post = async (): Promise<PostOutcome> =>
        ++sent === 1
          ? {
              status: 409,
              body: {
                issues: [{ path: 'values.sire', message: 'conflito' }],
                current: { 'values.sire': 'Etrius' },
                changedBy: { 'values.sire': 'storyteller' },
                sheetVersion: 2,
              },
            }
          : { status: 200, body: { sheetVersion: 3, sheet: helena } }
      const view = await renderLive(
        { model, sheet: helena, mode: 'evolve' },
        post
      )
      act(() => {
        view.store().getState().setDraftValue('values.sire', 'Meerlinda')
        view.store().getState().saveDraft('1 alteração')
      })
      expect(
        await screen.findByText('A ficha mudou em outro lugar')
      ).toBeTruthy()
      act(() => {
        view
          .store()
          .getState()
          .received(
            { ...helena, values: { ...helena.values, sire: 'Etrius' } },
            2
          )
      })
      fireEvent.press(screen.getByRole('button', { name: 'Revisar' }))
      const place = 'Identidade › Senhor'
      // O nome acessível diz o campo, com o texto visível primeiro
      expect(
        screen.getByRole('button', { name: `Usar o meu: ${place}` }).props
          .accessibilityLabel
      ).toBe(`Usar o meu: ${place}`)
      expect(
        screen.getByRole('button', { name: `Ficar com o atual: ${place}` })
          .props.accessibilityLabel
      ).toBe(`Ficar com o atual: ${place}`)
      expectSheetA11y(
        [`Usar o meu: ${place}`, `Ficar com o atual: ${place}`],
        target
      )
    }
  )
})
