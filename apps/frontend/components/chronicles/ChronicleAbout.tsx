import { Button, Text, tokens } from '@tms/ui'
import { useRouter } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { excerpt } from '../../lib/format'

// O bloco "Apresentação" no topo da crônica (P14-D, U-09, D-15): o começo da
// Descrição e "Ler tudo", que abre a tela de leitura. Para o narrador e para
// o jogador; sem Descrição, nada (o bloco não ocupa espaço).

/**
 * O trecho tem até 80 pontos de código (mais o "…"), cortado no código: cabe
 * em duas linhas de `body` a 360–411 com a fonte a 100%, então o que a tela
 * mostra é o que o leitor de tela anuncia, sem um segundo corte no desenho.
 * O bloco fica em até 104 px a 390 (onda-5.md §4.1).
 */
export const ABOUT_EXCERPT = 80

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
      {/* O corte é só no código, sem numberOfLines: a tela e o leitor de
          tela recebem o mesmo trecho, nunca os 4000 caracteres */}
      <Text testID="chronicle-about-excerpt">
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
