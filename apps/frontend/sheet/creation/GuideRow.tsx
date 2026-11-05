import { jsonEqual } from '@tms/sheet-core'
import { Pressable, Text, tokens, useLayout } from '@tms/ui'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector } from '../context'
import { useGuideNav } from './CreationContext'
import {
  allText,
  fitGuide,
  type GuideItem,
  guideItems,
  guidePrefix,
  MISSING_TARGET,
  moreText,
} from './guide'

// O "Faltam: …" da barra de criação (D-05, R-18): na linha dos botões, à
// esquerda do "Salvar", no lugar onde o "Concluir criação" aparece quando a
// conta fecha. Só itens inteiros; depois, "e mais N"; se nem um cabe, um
// botão só ("Faltam N itens"). Cada item é um botão que leva ao grupo. Os
// avisos que não bloqueiam (`confirm`) não entram aqui.

// A largura do "Salvar" na barra (P03-D §3.0) e o espaço entre os botões
const SAVE_WIDTH = 86

/** Os itens do "O que falta" da ficha aberta (sem os `confirm`). */
export function useGuideItems(): readonly GuideItem[] {
  const { model, roles } = useSheet()
  return useSheetSelector(
    s => guideItems(model, s.check, roles).filter(i => i.kind !== 'confirm'),
    jsonEqual
  )
}

export function GuideRow({ items }: { readonly items: readonly GuideItem[] }) {
  const goTo = useGuideNav()
  const { width: screen, fontScale } = useLayout()
  const [measured, setMeasured] = useState<number | null>(null)
  if (!items.length) return null
  // Antes da primeira medida, a estimativa pela janela
  const width =
    measured ?? screen - 2 * tokens.layout.gutter - SAVE_WIDTH - tokens.space[2]
  const fit = fitGuide(items, width, fontScale)
  const go = (item: GuideItem | null) =>
    goTo?.(item ? item.target : MISSING_TARGET)
  return (
    <View
      style={styles.row}
      testID="creation-guide"
      onLayout={e => setMeasured(e.nativeEvent.layout.width)}
    >
      {fit.shown.length ? (
        <>
          <Text variant="caption" color="inkMuted">
            {guidePrefix(items.length)}
          </Text>
          {fit.shown.map((item, i) => (
            <View key={item.key} style={styles.item}>
              {i ? <Separator /> : null}
              <GuideButton
                text={item.short}
                label={`${item.short}: ${item.text}`}
                hint="Vai ao grupo na ficha"
                danger={item.kind === 'blocking'}
                onPress={() => go(item)}
                testID={`creation-guide-${i}`}
              />
            </View>
          ))}
          {fit.more ? (
            <View style={styles.item}>
              <Separator />
              <GuideButton
                text={moreText(fit.more)}
                label={`${moreText(fit.more)}: ver tudo o que falta em Pontos`}
                onPress={() => go(null)}
                testID="creation-guide-more"
              />
            </View>
          ) : null}
        </>
      ) : (
        <GuideButton
          text={allText(fit.more)}
          label={`${allText(fit.more)}: ver tudo o que falta em Pontos`}
          danger={items.some(i => i.kind === 'blocking')}
          onPress={() => go(null)}
          testID="creation-guide-more"
        />
      )}
    </View>
  )
}

// O "·" fica fora dos alvos e não é lido
function Separator() {
  return (
    <Text variant="caption" color="inkMuted" aria-hidden>
      ·
    </Text>
  )
}

function GuideButton({
  text,
  label,
  hint,
  danger = false,
  onPress,
  testID,
}: {
  readonly text: string
  readonly label: string
  readonly hint?: string
  readonly danger?: boolean
  readonly onPress: () => void
  readonly testID: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      testID={testID}
      style={styles.button}
    >
      <Text
        variant="caption"
        color={danger ? 'danger' : 'action'}
        style={styles.link}
      >
        {text}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
    minWidth: 0,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[1],
  },
  button: { justifyContent: 'center' },
  link: { textDecorationLine: 'underline' },
})
