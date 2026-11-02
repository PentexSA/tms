import { Banner, tokens } from '@tms/ui'
import { StyleSheet, View } from 'react-native'

import { useSheet } from '../context'
import { useCreation } from './CreationContext'

// A devolução do narrador (T-06): o motivo aparece em qualquer modo, não só
// em Criação, e também na criação livre (o narrador pode liberá-la depois de
// devolver). O texto é para quem lê. O motivo vem só no GET da ficha, para o
// dono e o narrador; a lista da crônica sabe só que a ficha foi devolvida.

/**
 * O aviso com o motivo escrito pelo narrador. Reaproveitável: o "Aguardando
 * ajuste" (D-04, P04-D) mostra o motivo do mesmo jeito.
 */
export function NarratorReasonBanner({
  title,
  reason,
  testID,
}: {
  readonly title: string
  readonly reason: string
  readonly testID?: string
}) {
  return (
    <View style={styles.panel}>
      <Banner tone="warning" title={title} message={reason} testID={testID} />
    </View>
  )
}

/**
 * A ficha em criação devolvida ou com ajuste pedido (D-04): o motivo do
 * narrador, em qualquer modo. Só um existe por vez: o pedido de ajuste apaga
 * a devolução, e vice-versa (a API limpa os marcadores).
 */
export function ReturnedBanner() {
  const creation = useCreation()
  const { roles } = useSheet()
  if (creation?.status !== 'creating') return null
  const storyteller = roles.has('storyteller')
  const adjust = creation.info?.adjust
  if (adjust)
    return (
      <NarratorReasonBanner
        title={
          storyteller ? 'Você pediu um ajuste' : 'O narrador pediu um ajuste'
        }
        reason={adjust.reason}
        testID="creation-adjust"
      />
    )
  const returned = creation.info?.returned
  if (!returned) return null
  return (
    <NarratorReasonBanner
      title={
        storyteller ? 'Você devolveu esta ficha' : 'O narrador devolveu a ficha'
      }
      reason={returned.reason}
      testID="creation-returned"
    />
  )
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[4],
  },
})
