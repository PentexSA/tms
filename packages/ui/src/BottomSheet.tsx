import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react'
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
import { ModalToastHost } from './Toast'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Sheet modal (design system §9.5): o voltar do Android fecha, o fundo fica
// inerte para o leitor de tela (aria-modal) e o título é heading.
// Com "reduzir movimento", aparece sem animar. A raiz evita o teclado: no
// iOS a folha inteira (campo e rodapé) sobe acima dele.
//
// Um "Fechar" só: o fundo fecha no toque, mas fica fora da árvore e do Tab
// (no web o react-native-web não esconde os irmãos do modal). No iOS, o
// gesto de escape do VoiceOver ("Z") fecha. No web, o foco volta a quem
// abriu a folha, se ele ainda estiver na tela.

type Focusable = { focus?: () => void; isConnected?: boolean }
type WebDocument = { activeElement?: unknown; body?: unknown }

const webDocument = (): WebDocument | undefined =>
  Platform.OS === 'web'
    ? (globalThis as { document?: WebDocument }).document
    : undefined

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
  // Quem tinha o foco antes de abrir (web). Lido num layout effect, antes de
  // o trap do modal levar o foco para dentro.
  const trigger = useRef<Focusable | null>(null)
  useLayoutEffect(() => {
    const doc = webDocument()
    if (visible && doc)
      trigger.current = (doc.activeElement as Focusable) ?? null
  }, [visible])
  // Devolve o foco depois que o modal sai da tela (o trap já soltou o foco).
  // Se outro elemento pegou o foco de propósito, não o rouba.
  const restoreFocus = useCallback(() => {
    const el = trigger.current
    trigger.current = null
    if (!el) return
    setTimeout(() => {
      const doc = webDocument()
      if (!doc || !el.isConnected) return
      const active = doc.activeElement as Focusable | null | undefined
      if (active && active !== doc.body && active.isConnected && active !== el)
        return
      el.focus?.()
    }, 0)
  }, [])
  // Desmontar com a folha aberta (quem chama some com ela) também devolve
  useEffect(() => () => restoreFocus(), [restoreFocus])
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      onDismiss={restoreFocus}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessible={false}
          aria-hidden
          tabIndex={-1}
          accessibilityLabel="Fechar"
          testID="bottom-sheet-scrim"
          onPress={onClose}
          minTarget={false}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
        />
        <View
          testID={testID}
          aria-modal
          onAccessibilityEscape={onClose}
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
            <IconButton
              label="Fechar"
              glyph={'×'}
              onPress={onClose}
              testID="bottom-sheet-close"
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
          <ModalToastHost visible={visible} />
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
