import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { IconButton } from './IconButton'
import { useInsets } from './insets'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Sheet modal (design system §9.5): o voltar do Android fecha, o fundo fica
// inerte para o leitor de tela (aria-modal) e o título é heading.
// Com "reduzir movimento", aparece sem animar. A raiz evita o teclado: no
// iOS a folha inteira (campo e rodapé) sobe acima dele.

export interface BottomSheetProps {
  readonly visible: boolean
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly footer?: ReactNode
  readonly testID?: string
}

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  testID,
}: BottomSheetProps) {
  const { colors, reduceMotion } = useTheme()
  const insets = useInsets()
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
          minTarget={false}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        />
        <View
          testID={testID}
          aria-modal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.borderSubtle,
              paddingBottom: tokens.space[5] + insets.bottom,
            },
          ]}
        >
          <View style={styles.header}>
            <Text
              variant="title"
              accessibilityRole="header"
              aria-level={2}
              style={styles.title}
            >
              {title}
            </Text>
            <IconButton label="Fechar" glyph={'×'} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
    borderWidth: tokens.borderWidth.hair,
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[3],
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.space[3],
    paddingTop: tokens.space[4],
  },
})
