import type { FieldId } from '@tms/sheet-core'
import { Pressable } from '@tms/ui'
import type { ReactNode } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'
import { useOpenField } from '../play/sheetContext'

/**
 * O alvo acessível de um campo: numa ficha montada, em Jogo e Leitura, é um
 * botão que abre o detalhe (Etapa 17); fora disso (Evoluir, prévias), um
 * bloco com o mesmo nome e valor.
 */
export function FieldTarget({
  id,
  label,
  value,
  style,
  children,
}: {
  readonly id: FieldId
  readonly label: string
  readonly value?: string
  readonly style?: StyleProp<ViewStyle>
  readonly children: ReactNode
}) {
  const open = useOpenField(id)
  const accessibilityValue = value ? { text: value } : undefined
  if (open)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={accessibilityValue}
        accessibilityHint="Abre o detalhe"
        onPress={open}
        style={style}
      >
        {children}
      </Pressable>
    )
  return (
    <View
      accessible
      accessibilityLabel={label}
      accessibilityValue={accessibilityValue}
      style={style}
    >
      {children}
    </View>
  )
}
