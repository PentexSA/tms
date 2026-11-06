import { Button, Text, tokens } from '@tms/ui'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { excerpt } from '../../lib/format'

// O bloco "Apresentação" no topo da crônica (P14-D, U-09, D-15): o começo da
// Descrição e "Ler tudo", que abre a tela de leitura. Para o narrador e para
// o jogador; sem Descrição, nada (o bloco não ocupa espaço).

/** O trecho tem até 140 pontos de código (mais o "…"), cortado no código. */
export const ABOUT_EXCERPT = 140

export function ChronicleAbout({
  chronicleId,
  description,
}: {
  readonly chronicleId: string
  readonly description: string
}) {
  const router = useRouter()
  if (description.trim() === '') return null
  return (
    <View style={styles.root} testID="chronicle-about">
      <View style={styles.header}>
        <Text variant="caption" color="inkMuted">
          Apresentação
        </Text>
        <Button
          title="Ler tudo"
          variant="ghost"
          // O nome começa pelo texto visível (WCAG 2.5.3) e diz o que abre
          accessibilityLabel="Ler tudo: apresentação da crônica"
          onPress={() => router.push(`/chronicles/${chronicleId}/about`)}
        />
      </View>
      {/* O corte é no código: o leitor de tela recebe o trecho, nunca os
          4000 caracteres; o numberOfLines só limita o desenho */}
      <Text numberOfLines={2} testID="chronicle-about-excerpt">
        {excerpt(description, ABOUT_EXCERPT)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: tokens.space[1] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[2],
  },
})
