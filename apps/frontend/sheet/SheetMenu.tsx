import { BottomSheet, Button, IconButton, tokens } from '@tms/ui'
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  StatusMenu,
  type StatusMenuDraft,
  type StatusMenuTarget,
  statusActions,
} from './storyteller/StatusMenu'

// "Mais opções" do cabeçalho da ficha (T-11; DS: CharacterHeader). Abaixo de
// 900, as ações do cabeçalho não cabem lado a lado: elas viram um ⋯ que abre
// esta folha, com as mesmas condições de hoje. Nada sai da ficha: cada item
// continua a um toque do menu.
//
// O item tocado fecha o menu, e a folha dele abre depois que o menu sai da
// tela (onClosed): no iOS, dois Modais não se apresentam ao mesmo tempo, e
// no web o foco volta ao ⋯ antes, para a folha seguinte devolvê-lo a ele.

export interface SheetMenuProps {
  /** As ações do narrador (só para quem narra): a ficha e o rascunho. */
  readonly narrator?: StatusMenuTarget | null
  readonly draft?: StatusMenuDraft
  /** "Experiência", quando o template tem extrato de XP. */
  readonly onExperience?: (() => void) | null
  readonly onHistory: () => void
}

export function SheetMenu({
  narrator,
  draft = {},
  onExperience,
  onHistory,
}: SheetMenuProps) {
  const [open, setOpen] = useState(false)
  const [narrating, setNarrating] = useState(false)
  // As mesmas condições do botão da tela larga: só com ação no estado
  const actions = narrator
    ? statusActions(
        narrator.model,
        narrator.status,
        narrator.locked,
        draft.approval,
        narrator.adjustable
      )
    : []
  const state = narrator?.state?.label ?? null
  const next = useRef<(() => void) | null>(null)
  const pick = (then: () => void) => () => {
    next.current = then
    setOpen(false)
  }
  return (
    <>
      <IconButton
        label="Mais opções"
        glyph="⋯"
        testID="sheet-menu"
        onPress={() => setOpen(true)}
      />
      <BottomSheet
        visible={open}
        title="Mais opções"
        onClose={() => setOpen(false)}
        onClosed={() => {
          const run = next.current
          next.current = null
          run?.()
        }}
      >
        <View style={styles.list}>
          {narrator && actions.length ? (
            <Button
              title={
                state ? `Ações do narrador · ${state}` : 'Ações do narrador'
              }
              variant="secondary"
              testID="sheet-menu-narrator"
              onPress={pick(() => setNarrating(true))}
            />
          ) : null}
          {onExperience ? (
            <Button
              title="Experiência"
              variant="secondary"
              testID="xp-open"
              accessibilityHint="Abre o saldo, os pedidos e o extrato de XP"
              onPress={pick(onExperience)}
            />
          ) : null}
          <Button
            title="Histórico"
            variant="secondary"
            testID="sheet-menu-history"
            accessibilityHint="Abre o histórico de alterações da ficha"
            onPress={pick(onHistory)}
          />
        </View>
      </BottomSheet>
      {narrator && narrating ? (
        // As mesmas props do StatusMenuButton: o que ele ganhar, o menu
        // repassa (onda-2 §4.4)
        <StatusMenu
          characterId={narrator.characterId}
          chronicleId={narrator.chronicleId}
          actions={actions}
          draft={draft}
          onClose={() => setNarrating(false)}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  list: { gap: tokens.space[2] },
})
