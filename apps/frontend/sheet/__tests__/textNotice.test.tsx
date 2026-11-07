import { fireEvent, render, screen } from '@testing-library/react-native'
import type { RoleName } from '@tms/sheet-core'
import { Platform } from 'react-native'

import { modelOf, sheetFor } from '../../test/fixtures'
import { SheetProvider } from '../context'
import { TextEditorRow } from '../evolve/TextEditorRow'
import { createSheetStore } from '../store/sheetStore'
import {
  editorNotice,
  hiddenFromOwner,
  PRIVATE_NOTE_SHEET,
  readByOwner,
  SHARED_NOTE_SHEET,
} from '../storyteller/privacy'

// U-10 (P15-D): o editor de texto diz quando o jogador lê o texto. A regra
// vem das permissões do template, sem nome de campo, e só vale para o
// narrador numa ficha de jogador que não é dele.

const SYSTEMS = ['vtm-v20', 'mta-m20', 'wta-w20']

describe('editorNotice: a regra, nos três sistemas', () => {
  it.each(SYSTEMS)('%s', system => {
    const model = modelOf(system)
    // A História e as Notas do jogador: o dono lê
    for (const id of ['backstory', 'notes']) {
      expect(readByOwner(model, id)).toBe(true)
      expect(hiddenFromOwner(model, id)).toBe(false)
      expect(editorNotice(model, id, ['storyteller'], false)).toBe(
        SHARED_NOTE_SHEET
      )
    }
    // As Notas do Narrador continuam privadas, e nunca "o jogador lê"
    expect(
      editorNotice(model, 'storytellerNotes', ['storyteller'], false)
    ).toBe(PRIVATE_NOTE_SHEET)
    expect(editorNotice(model, 'storytellerNotes', ['storyteller'], true)).toBe(
      PRIVATE_NOTE_SHEET
    )
    // O dono, e o narrador na própria ficha, não recebem aviso
    expect(editorNotice(model, 'backstory', ['owner'], false)).toBeNull()
    expect(
      editorNotice(model, 'backstory', ['owner', 'storyteller'], false)
    ).toBeNull()
    // NPC: não há jogador dono
    expect(editorNotice(model, 'backstory', ['storyteller'], true)).toBeNull()
    // Papel sem escrita nem leitura de narrador
    expect(editorNotice(model, 'backstory', ['viewer'], false)).toBeNull()
  })
})

function row(
  roles: RoleName[],
  { npc = false, value = 'Um texto curto.' } = {}
) {
  const model = modelOf('vtm-v20')
  const base = sheetFor('helena', ['storyteller']).sheet
  const store = createSheetStore({
    characterId: 'c1',
    model,
    sheet: { ...base, values: { ...base.values, backstory: value } },
    sheetVersion: 1,
    roles,
    mode: 'evolve',
    npc,
  })
  store.getState().startDraft()
  const state = store.getState()
  const resolved = state.resolved.get('backstory')
  if (!resolved) throw new Error('sem a História')
  render(
    <SheetProvider store={store}>
      <TextEditorRow resolved={resolved} sheet={state.resolved} />
    </SheetProvider>
  )
  fireEvent.press(screen.getByTestId('editor-backstory'))
}

// O campo da folha (a linha da ficha também leva o rótulo no nome)
const input = () => {
  const field = screen
    .getAllByLabelText('História / Prelúdio')
    .find(e => typeof e.props.onChangeText === 'function')
  if (!field) throw new Error('sem o campo')
  return field
}

describe('TextEditorRow: o aviso na folha do editor', () => {
  it('o narrador, na ficha do jogador: "O jogador lê este texto." visível e na dica', () => {
    row(['storyteller'])
    const notice = screen.getByText(SHARED_NOTE_SHEET)
    expect(notice.props.nativeID).toMatch(/-notice$/)
    const field = input()
    expect(field.props.accessibilityHint).toMatch(/^O jogador lê este texto\./)
    // A dica do template continua junto
    expect(field.props.accessibilityHint).toContain(
      'A história do personagem antes da crônica.'
    )
    expect(screen.queryByText(PRIVATE_NOTE_SHEET)).toBeNull()
  })

  it('no web, o campo aponta o aviso pelo aria-describedby', () => {
    const original = Platform.OS
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    try {
      row(['storyteller'])
      const notice = screen.getByText(SHARED_NOTE_SHEET)
      expect(input().props).toMatchObject({
        'aria-describedby': notice.props.nativeID,
      })
    } finally {
      Object.defineProperty(Platform, 'OS', {
        value: original,
        configurable: true,
      })
    }
  })

  it('o dono não recebe aviso', () => {
    row(['owner'])
    expect(screen.queryByText(SHARED_NOTE_SHEET)).toBeNull()
    expect(screen.queryByText(PRIVATE_NOTE_SHEET)).toBeNull()
    expect(input().props.accessibilityHint).toBe(
      'A história do personagem antes da crônica.'
    )
  })

  it('o narrador num NPC não recebe "O jogador lê"', () => {
    row(['storyteller'], { npc: true })
    expect(screen.queryByText(SHARED_NOTE_SHEET)).toBeNull()
  })
})
