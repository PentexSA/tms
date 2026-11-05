import { Button, Text, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'
import { useOpenBudget } from '../creation/CreationContext'
import type { DraftNotice } from '../store/sheetStore'

// O aviso de um toque recusado, ao lado do toque (R-20, T-20): na coluna do
// rótulo, na altura do "+", não embaixo da linha. `key` pelo id: a mesma
// recusa repetida é anunciada de novo pelo leitor de tela. O `nativeID` vira
// o `id` no web, alvo do `aria-describedby` do "+".

export function DraftNoticeText({
  notice,
  field,
}: {
  readonly notice: DraftNotice
  // O id do campo: `notice-<campo>` no testID e no nativeID
  readonly field: string
}) {
  const openBudget = useOpenBudget()
  return (
    <View style={styles.wrap}>
      <Text
        key={notice.id}
        variant="caption"
        color="danger"
        accessibilityRole="alert"
        nativeID={`notice-${field}`}
        testID={`notice-${field}`}
      >
        {notice.text}
      </Text>
      {notice.action === 'budget' && openBudget ? (
        <View style={styles.action}>
          <Button
            title="Ver Pontos"
            variant="ghost"
            onPress={openBudget}
            testID={`notice-${field}-budget`}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space['0.5'] },
  action: { alignItems: 'flex-start' },
})
