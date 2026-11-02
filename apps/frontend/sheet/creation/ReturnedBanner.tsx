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

/** A ficha em criação devolvida: o motivo do narrador, em qualquer modo. */
export function ReturnedBanner() {
  const creation = useCreation()
  const { roles } = useSheet()
  const returned = creation?.info?.returned
  if (creation?.status !== 'creating' || !returned) return null
  return (
    <NarratorReasonBanner
      title={
        roles.has('storyteller')
          ? 'Você devolveu esta ficha'
          : 'O narrador devolveu a ficha'
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
