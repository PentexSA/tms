import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native'
import type { SheetData } from '@tms/sheet-core'
import { AccessibilityInfo, StyleSheet } from 'react-native'
import { example, modelOf } from '../../../test/fixtures'
import { fakeServer, renderLive } from '../../../test/live'
import type { PostOutcome } from '../../sync/sender'

// Etapa 18: o modo Evoluir na ficha viva. O rascunho vira UM lote ao salvar
// (doc/arquitetura §6.5) e o resumo usa o describeEvent do core.

const model = modelOf('vtm-v20')
const nova: SheetData = {
  values: { name: 'Nova', clan: 'tremere', strength: 2 },
  specialties: {},
}

const increment = (name: string) =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
    nativeEvent: { actionName: 'increment' },
  })
const decrement = (name: string) =>
  fireEvent(screen.getByRole('adjustable', { name }), 'accessibilityAction', {
    nativeEvent: { actionName: 'decrement' },
  })

const enterEvolve = () =>
  fireEvent.press(screen.getByRole('radio', { name: 'Evoluir' }))

/** Força 2 → 3, Taumaturgia 1 adicionada e a especialização de Força. */
function evolveThree() {
  enterEvolve()
  expect(screen.getByText('Evoluindo · 0 alterações')).toBeTruthy()
  increment('Força')
  expect(screen.getByText('Evoluindo · 1 alteração')).toBeTruthy()

  fireEvent.press(
    screen.getByRole('button', { name: 'Adicionar especialização em Força' })
  )
  fireEvent.changeText(screen.getByLabelText('Especialização'), 'Pegada firme')
  fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
  expect(screen.getByText('Evoluindo · 2 alterações')).toBeTruthy()

  fireEvent.press(screen.getByRole('tab', { name: 'Vantagens' }))
  expect(screen.getByText('Nenhuma Disciplina')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar Disciplina' }))
  fireEvent.changeText(screen.getByLabelText('Buscar Disciplina'), 'tauma')
  fireEvent.press(screen.getByRole('button', { name: 'Taumaturgia' }))
  expect(screen.getByText('Evoluindo · 3 alterações')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Taumaturgia, 1 de 5' })
  ).toBeTruthy()
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
})

describe('Evoluir: o rascunho e o resumo', () => {
  it('o resumo lista as 3 alterações e Salvar manda UM lote com 3 eventos', async () => {
    const server = fakeServer(model, nova)
    await renderLive({ model, sheet: nova }, server.post)
    expect(screen.getByRole('radio', { name: 'Leitura' })).toBeChecked()
    evolveThree()
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Modo Evoluir'
    )
    // Nada saiu do aparelho enquanto evoluía
    expect(server.post).not.toHaveBeenCalled()

    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    expect(screen.getByText('Salvar 3 alterações?')).toBeTruthy()
    const summary = within(screen.getByTestId('evolve-summary'))
    expect(summary.getByLabelText('Força, 2 → 3')).toBeTruthy()
    expect(summary.getByLabelText('Disciplinas, 0 → 1 item')).toBeTruthy()
    expect(
      summary.getByLabelText('Força · especialização, atualizada')
    ).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(server.post).toHaveBeenCalledTimes(1))
    expect(server.sent[0]?.events.map(e => e.path)).toEqual([
      'values.strength',
      'values.disciplines',
      'specialties.strength',
    ])
    expect(server.sent[0]?.label).toBe('3 alterações')
    expect(screen.getByText('Salvo: 3 alterações')).toBeTruthy()
    // Volta ao modo de onde veio, com os valores salvos
    expect(screen.getByRole('radio', { name: 'Leitura' })).toBeChecked()
    expect(server.current().values.disciplines as unknown).toEqual([
      { id: 'i1', name: 'Taumaturgia', value: 1 },
    ])
    expect(server.current().specialties?.strength).toBe('Pegada firme')
  })

  it('Descartar volta tudo e não manda nada', async () => {
    const server = fakeServer(model, nova)
    await renderLive({ model, sheet: nova }, server.post)
    evolveThree()
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    fireEvent.press(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByRole('radio', { name: 'Leitura' })).toBeChecked()
    expect(screen.getByText('Nenhuma Disciplina')).toBeTruthy()
    fireEvent.press(screen.getByRole('tab', { name: 'Ficha' }))
    expect(screen.getByLabelText('Força, 2 de 5')).toBeTruthy()
    expect(server.post).not.toHaveBeenCalled()
  })

  it('Desfazer depois de salvar manda o lote inverso', async () => {
    const server = fakeServer(model, nova)
    await renderLive({ model, sheet: nova }, server.post)
    enterEvolve()
    increment('Força')
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(server.post).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }))
    await waitFor(() => expect(server.post).toHaveBeenCalledTimes(2))
    expect(server.sent[1]?.events).toEqual([
      { path: 'values.strength', from: 3, to: 2 },
    ])
  })

  it('voltar ao valor de antes tira a alteração da conta', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    increment('Força')
    decrement('Força')
    expect(screen.getByText('Evoluindo · 0 alterações')).toBeTruthy()
  })

  it('Concluir sem alterações sai direto; trocar de modo com rascunho passa pelo resumo', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    expect(screen.queryByText('Salvar 0 alterações?')).toBeNull()
    expect(screen.getByRole('radio', { name: 'Leitura' })).toBeChecked()

    enterEvolve()
    increment('Força')
    fireEvent.press(screen.getByRole('radio', { name: 'Jogo' }))
    expect(screen.getByText('Salvar 1 alteração?')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByRole('radio', { name: 'Jogo' })).toBeChecked()
    expect(screen.queryByText(/^Evoluindo/)).toBeNull()
  })

  it('o jogador sem escrita não vê os modos', async () => {
    const helena = example('helena').sheet
    await renderLive(
      { model, sheet: helena, roles: ['player'] },
      fakeServer(model, helena).post
    )
    expect(screen.queryByRole('radio', { name: 'Evoluir' })).toBeNull()
  })
})

describe('Evoluir: o servidor recusa (422)', () => {
  it('marca o campo indicado no path e volta para Evoluir com o rascunho', async () => {
    const post = jest.fn(
      async (): Promise<PostOutcome> => ({
        status: 422,
        body: {
          issues: [
            {
              path: 'values.strength',
              message: 'acima do permitido nesta crônica',
            },
          ],
        },
      })
    )
    await renderLive({ model, sheet: nova }, post)
    enterEvolve()
    increment('Força')
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(
      await screen.findByText('acima do permitido nesta crônica')
    ).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Evoluir' })).toBeChecked()
    expect(screen.getByText('Evoluindo · 1 alteração')).toBeTruthy()
    expect(
      screen.getByText(
        'O servidor recusou “Força 2 → 3”. Confira os campos marcados em Evoluir.'
      )
    ).toBeTruthy()
    // Corrigir o campo tira a marca
    decrement('Força')
    expect(screen.queryByText('acima do permitido nesta crônica')).toBeNull()
  })

  it('conflito ao salvar mantém o resumo aberto com o aviso', async () => {
    const server = fakeServer(model, nova)
    const { store } = await renderLive({ model, sheet: nova }, server.post)
    enterEvolve()
    increment('Força')
    // Outra pessoa mudou a Força enquanto evoluía
    act(() => {
      store()
        .getState()
        .received({ ...nova, values: { ...nova.values, strength: 4 } }, 2)
    })
    fireEvent.press(screen.getByRole('button', { name: 'Concluir' }))
    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(
      screen.getByText(/^Alguém mudou um destes campos enquanto você evoluía/)
    ).toBeTruthy()
    expect(server.post).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('button', { name: 'Descartar' }))
    expect(screen.getByLabelText('Força, 4 de 5')).toBeTruthy()
  })
})

describe('Evoluir: editores', () => {
  it('tocar no valor abre o teclado numérico; fora da faixa avisa', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    fireEvent(
      screen.getByRole('adjustable', { name: 'Força' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'activate' } }
    )
    const input = screen.getByLabelText('Força, de 1 a 5')
    expect(input.props.keyboardType).toBe('number-pad')
    fireEvent(input, 'submitEditing', { nativeEvent: { text: '9' } })
    expect(screen.getByText('Digite um número de 1 a 5')).toBeTruthy()
    fireEvent(screen.getByLabelText('Força, de 1 a 5'), 'submitEditing', {
      nativeEvent: { text: '4' },
    })
    expect(screen.getByText('Evoluindo · 1 alteração')).toBeTruthy()
    expect(
      screen.getByRole('adjustable', { name: 'Força' })
    ).toHaveAccessibilityValue({ now: 4 })
  })

  it('trocar o Clã muda o accent da ficha', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    // A borda do selo do Clã é a cor do accent (IdentityBlock)
    const chipColor = (label: string) => {
      for (const text of screen.getAllByText(label)) {
        let node = text.parent
        for (let i = 0; node && i < 4; i++, node = node.parent) {
          const color = StyleSheet.flatten(node.props.style)?.borderColor
          if (color) return color
        }
      }
      return undefined
    }
    const before = chipColor('Tremere')
    enterEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Clã: Tremere' }))
    fireEvent.press(screen.getByRole('radio', { name: 'Brujah' }))
    expect(screen.getByRole('button', { name: 'Clã: Brujah' })).toBeTruthy()
    const after = chipColor('Brujah')
    expect(before).toBeTruthy()
    expect(after).toBeTruthy()
    expect(after).not.toBe(before)
  })

  it('texto em sheet com contador; o nome não fica vazio', async () => {
    await renderLive({ model, sheet: nova }, fakeServer(model, nova).post)
    enterEvolve()
    fireEvent.press(screen.getByRole('button', { name: 'Conceito: vazio' }))
    fireEvent.changeText(screen.getByLabelText('Conceito'), 'Arquivista')
    expect(screen.getByText(/^10\//)).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(
      screen.getByRole('button', { name: 'Conceito: Arquivista' })
    ).toBeTruthy()

    fireEvent.press(screen.getByRole('button', { name: 'Nome: Nova' }))
    fireEvent.changeText(screen.getByLabelText('Nome (obrigatório)'), '   ')
    fireEvent.press(screen.getByRole('button', { name: 'Aplicar' }))
    expect(screen.getByText('Informe o nome')).toBeTruthy()
  })

  it('o permanente da FdV leva o atual junto quando baixa', async () => {
    const helena = example('helena').sheet
    const { store } = await renderLive(
      { model, sheet: helena, mode: 'evolve' },
      fakeServer(model, helena).post
    )
    decrement('Força de Vontade permanente')
    expect(store().getState().draftEvents()).toEqual([
      {
        path: 'values.willpower',
        from: { current: 5, permanent: 7 },
        to: { current: 5, permanent: 6 },
      },
    ])
    for (let i = 0; i < 3; i++) decrement('Força de Vontade permanente')
    expect(store().getState().draftEvents()[0]?.to).toEqual({
      current: 3,
      permanent: 3,
    })
    increment('Força de Vontade atual')
    expect(
      screen.getByRole('adjustable', { name: 'Força de Vontade atual' })
    ).toHaveAccessibilityValue({ now: 3 })
  })

  it('a ficha recém-criada abre em Evoluir', async () => {
    await renderLive(
      { model, sheet: nova, mode: 'evolve' },
      fakeServer(model, nova).post
    )
    expect(screen.getByRole('radio', { name: 'Evoluir' })).toBeChecked()
    expect(screen.getByText('Evoluindo · 0 alterações')).toBeTruthy()
    // Sem filtro em Evoluir: todas as Habilidades, para comprar o 1º ponto
    expect(screen.queryByRole('switch', { name: 'Só com pontos' })).toBeNull()
    expect(screen.getByRole('adjustable', { name: 'Ocultismo' })).toBeTruthy()
  })
})
