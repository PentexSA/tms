import { act, fireEvent, screen, waitFor } from '@testing-library/react-native'
import type { SheetData } from '@tms/sheet-core'
import { example, modelOf } from '../../test/fixtures'
import { renderLive } from '../../test/live'
import type { QueuedBatch } from '../sync/outbox'
import type { PostOutcome } from '../sync/sender'

// T-31 (QAW-20): o narrador salvou o Senhor; o jogador salvou um rascunho de
// 7 alterações. Antes, o lote inteiro era recusado, a faixa culpava os 7 e
// "Reaplicar" sobrescrevia o valor do narrador sem mostrá-lo.

const model = modelOf('vtm-v20')
const helena = example('helena').sheet
const withSire = (sire: string): SheetData => ({
  ...helena,
  values: { ...helena.values, sire },
})

async function sevenWithSireConflict() {
  const sent: QueuedBatch[] = []
  const post = jest.fn(
    async (_: string, b: QueuedBatch): Promise<PostOutcome> => {
      sent.push(b)
      return sent.length === 1
        ? {
            status: 409,
            body: {
              issues: [{ path: 'values.sire', message: 'conflito' }],
              current: { 'values.sire': 'Etrius' },
              sheetVersion: 2,
            },
          }
        : { status: 200, body: { sheetVersion: 3, sheet: withSire('Etrius') } }
    }
  )
  const view = await renderLive({ model, sheet: helena, mode: 'evolve' }, post)
  const s = () => view.store().getState()
  act(() => {
    for (const [path, to] of [
      ['values.strength', 3],
      ['values.dexterity', 3],
      ['values.appearance', 3],
      ['values.occult', 5],
      ['values.sire', 'Meerlinda'],
      ['values.concept', 'Arquivista'],
      ['values.demeanor', 'Galã'],
    ] as const)
      s().setDraftValue(path, to)
    s().saveDraft('7 alterações')
  })
  expect(await screen.findByText('A ficha mudou em outro lugar')).toBeTruthy()
  // A ficha rebuscada: o Senhor do narrador
  act(() => {
    s().received(withSire('Etrius'), 2)
  })
  return { ...view, s, post, sent }
}

it('a faixa nomeia só o Senhor, sem "Reaplicar"; as outras 6 ficam no rascunho', async () => {
  await sevenWithSireConflict()
  expect(
    screen.getByText(
      'Senhor foi alterado antes de a sua alteração chegar. As outras 6 continuam no rascunho.'
    )
  ).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Reaplicar' })).toBeNull()
  expect(screen.getByText('Editando · 7 alterações')).toBeTruthy()
})

it('"Revisar" mostra os dois valores, e escolher na mesma linha resolve', async () => {
  const { s, post, sent } = await sevenWithSireConflict()
  fireEvent.press(screen.getByRole('button', { name: 'Revisar' }))
  expect(
    screen.getByLabelText(
      'Identidade › Senhor. Seu valor: Meerlinda. Valor atual: Etrius.'
    )
  ).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Ficar com o atual' }))
  expect(screen.queryByText('A ficha mudou em outro lugar')).toBeNull()
  expect(s().draft?.size).toBe(6)
  // As outras 6 se salvam; o Senhor do narrador fica
  act(() => {
    s().saveDraft('6 alterações')
  })
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  expect(sent[1]?.events.map(e => e.path)).not.toContain('values.sire')
  expect(sent[1]?.events).toHaveLength(6)
})

it('"Usar o meu" grava o seu valor sobre o de agora', async () => {
  const { s } = await sevenWithSireConflict()
  fireEvent.press(screen.getByRole('button', { name: 'Revisar' }))
  fireEvent.press(screen.getByRole('button', { name: 'Usar o meu' }))
  expect(s().conflict).toBeNull()
  expect(s().draft?.get('values.sire')).toEqual({
    from: 'Etrius',
    to: 'Meerlinda',
  })
})
