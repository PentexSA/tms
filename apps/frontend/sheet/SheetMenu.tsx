import { BottomSheet, Button, IconButton, tokens } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { stateLabel } from '../components/chronicles/tableItems'
import {
  StatusMenu,
  type StatusMenuButtonProps,
  statusActions,
} from './storyteller/StatusMenu'

// "Mais opções" do cabeçalho da ficha (T-11; DS: CharacterHeader). Abaixo de
// 900, as ações do cabeçalho não cabem lado a lado: elas viram um ⋯ que abre
// esta folha, com as mesmas condições de hoje. Nada sai da ficha: cada item
// continua a um toque do menu.
//
// O item tocado fecha o menu e abre a folha dele no mesmo render, como o
// StatusMenu troca a lista pela confirmação.

export interface SheetMenuProps {
  /** As ações do narrador (só para quem narra), com as props do StatusMenu. */
  readonly narrator?: StatusMenuButtonProps | null
  /** "Experiência", quando o template tem extrato de XP. */
  readonly onExperience?: (() => void) | null
  readonly onHistory: () => void
}

export function SheetMenu({
  narrator,
  onExperience,
  onHistory,
}: SheetMenuProps) {
  const [open, setOpen] = useState(false)
  const [narrating, setNarrating] = useState(false)
  // As mesmas condições do botão da tela larga: só com ação no estado
  const actions = narrator
    ? statusActions(narrator.model, narrator.status, narrator.locked)
    : []
  const state = narrator
    ? stateLabel(narrator.model, narrator.status, narrator.locked)
    : null
  const pick = (then: () => void) => () => {
    setOpen(false)
    then()
  }
  return (
    <>
      <IconButton
        label="Mais opções"
        glyph="⋯"
        testID="sheet-menu"
        onPress={() => setOpen(true)}
      />
      {open ? (
        <BottomSheet visible title="Mais opções" onClose={() => setOpen(false)}>
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
      ) : null}
      {narrator && narrating ? (
        // As mesmas props do StatusMenuButton: o que ele ganhar, o menu
        // repassa (onda-2 §4.4)
        <StatusMenu
          {...narrator}
          actions={actions}
          onClose={() => setNarrating(false)}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  list: { gap: tokens.space[2] },
})
