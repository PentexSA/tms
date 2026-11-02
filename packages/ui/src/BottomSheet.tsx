import {
  type ReactNode,
  useCallback,
  useEffect,
  useInsertionEffect,
  useRef,
} from 'react'
import {
  KeyboardAvoidingView,
  type KeyDownEvent,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import { IconButton } from './IconButton'
import { useInsets } from './insets'
import { keyboardBehavior } from './keyboard'
import { Pressable } from './Pressable'
import { keyOf } from './roving'
import { Text } from './Text'
import { ModalToastHost } from './Toast'
import { useLayout, useTheme } from './theme'
import { tokens } from './tokens'

// Sheet modal (design system §9.5): o voltar do Android fecha, o fundo fica
// inerte para o leitor de tela (aria-modal) e o título é heading.
// Com "reduzir movimento", aparece sem animar. A raiz evita o teclado no iOS
// e no Android (T-10): a folha inteira (campo e rodapé) sobe acima dele. No
// Android a janela do Modal é edge-to-edge e não redimensiona com o
// teclado; sem o `padding`, o teclado cobria o campo e o "Aplicar".
//
// Um "Fechar" só: o fundo fecha no toque, mas fica fora da árvore e do Tab
// (no web o react-native-web não esconde os irmãos do modal). No iOS, o
// gesto de escape do VoiceOver ("Z") fecha. No web, o foco volta a quem
// abriu a folha, se ele ainda estiver na tela.
//
// Esc no web (T-71): o Modal do react-native-web só fecha com Esc depois
// que a animação de entrada termina (~270 ms, o onShow que o deixa
// "ativo"); antes disso a tecla se perdia, e a folha com campo em
// autoFocus ficava aberta com o foco dentro dela. Aqui o Esc é tratado na
// fase de captura da raiz da folha (o TextInput do react-native-web não
// deixa o keydown subir), a qualquer momento em que o foco esteja nela. É o
// único caminho no web: o onRequestClose fica só para o voltar do Android.
// O fundo no web é um View sem tabindex: um Pressable sempre é focável, e o
// trap do modal focava o fundo oculto ao entrar.
//
// Por que não basta o ModalFocusTrap do react-native-web: ele guarda o
// elemento focado num efeito passivo, depois da montagem. Quando a folha
// tem um campo com autoFocus ("Adicionar Antecedente", os editores de
// texto), o React já focou o campo na fase de layout, e o trap guarda o
// campo de dentro da folha, que some ao fechar: o foco cai no body
// (QAW-28). Aqui o gatilho é lido num insertion effect, que roda antes da
// fase de layout e, portanto, antes de qualquer autoFocus.

type Focusable = { focus?: () => void; isConnected?: boolean }
type WebDocument = {
  activeElement?: unknown
  body?: unknown
  addEventListener?: (
    type: string,
    listener: (e: { target?: unknown }) => void,
    capture?: boolean
  ) => void
}

const webDocument = (): WebDocument | undefined =>
  Platform.OS === 'web'
    ? (globalThis as { document?: WebDocument }).document
    : undefined

// O último elemento que recebeu foco no documento (web). Um botão que fica
// ocupado ao abrir a folha (o "Sair" do logout) é desabilitado, e o
// navegador tira o foco dele: na abertura o foco está no body, e quem abriu
// a folha é o último focado.
let lastFocused: Focusable | null = null
const tracked = new WeakSet<object>()
function trackFocus(doc: WebDocument) {
  if (tracked.has(doc) || typeof doc.addEventListener !== 'function') return
  tracked.add(doc)
  doc.addEventListener(
    'focusin',
    e => {
      if (e.target && e.target !== doc.body) lastFocused = e.target as Focusable
    },
    true
  )
}

export interface BottomSheetProps {
  readonly visible: boolean
  readonly title: string
  readonly onClose: () => void
  readonly children: ReactNode
  readonly footer?: ReactNode
  readonly testID?: string
  /**
   * Depois que a folha sai da tela (fim da animação de saída), com o foco
   * já de volta ao gatilho no web. É onde se abre a folha seguinte: no iOS,
   * apresentar um Modal enquanto outro ainda sai falha, e no web a folha
   * seguinte guarda o gatilho certo para devolver o foco.
   */
  readonly onClosed?: () => void
}

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  testID,
  onClosed,
}: BottomSheetProps) {
  const { colors, reduceMotion } = useTheme()
  const insets = useInsets()
  // T-69 (DS: "a partir de 600 vira modal centralizado de até 560"): no
  // compact a folha fica presa embaixo; fora dele, é um diálogo central
  const dialog = useLayout().breakpoint !== 'compact'
  // Quem tinha o foco antes de abrir (web), lido antes do autoFocus de
  // qualquer campo da folha e antes do trap do modal
  const trigger = useRef<Focusable | null>(null)
  useInsertionEffect(() => {
    const doc = webDocument()
    if (!visible || !doc) return
    const active = doc.activeElement as Focusable | null | undefined
    trigger.current = active && active !== doc.body ? active : lastFocused
  }, [visible])
  useEffect(() => {
    const doc = webDocument()
    if (doc) trackFocus(doc)
  }, [])
  // Um caminho só para devolver o foco, uma vez por abertura (o gatilho é
  // zerado na primeira chamada). Roda depois que o modal sai da tela, quando
  // o trap já soltou o foco: no onDismiss (a folha fecha e continua montada)
  // ou ao desmontar aberta (quem chama some com ela; aí não há onDismiss).
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
  useEffect(() => () => restoreFocus(), [restoreFocus])
  const closed = useRef(onClosed)
  closed.current = onClosed
  // iOS e web: o onDismiss do Modal; o aviso vem depois da devolução do
  // foco, que espera um tick
  const dismissed = useCallback(() => {
    restoreFocus()
    setTimeout(() => closed.current?.(), 0)
  }, [restoreFocus])
  // Android: sem onDismiss, o Modal sai assim que fica invisível
  const wasVisible = useRef(visible)
  useEffect(() => {
    const closing = wasVisible.current && !visible
    wasVisible.current = visible
    if (closing && Platform.OS === 'android') closed.current?.()
  }, [visible])
  const web = Platform.OS === 'web'
  const scrimStyle = [
    StyleSheet.absoluteFill,
    { backgroundColor: colors.scrim },
  ]
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : dialog ? 'fade' : 'slide'}
      onRequestClose={web ? undefined : onClose}
      onDismiss={dismissed}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        testID="bottom-sheet-root"
        style={[styles.root, dialog && styles.rootDialog]}
        behavior={keyboardBehavior()}
        {...(web
          ? {
              onKeyDownCapture: (e: KeyDownEvent) => {
                if (keyOf(e).key !== 'Escape') return
                e.preventDefault()
                onClose()
              },
            }
          : {})}
      >
        {web ? (
          <View
            aria-hidden
            testID="bottom-sheet-scrim"
            {...{ onClick: onClose }}
            style={scrimStyle}
          />
        ) : (
          <Pressable
            accessible={false}
            aria-hidden
            accessibilityLabel="Fechar"
            testID="bottom-sheet-scrim"
            onPress={onClose}
            minTarget={false}
            style={scrimStyle}
          />
        )}
        <View
          testID={testID}
          aria-modal
          onAccessibilityEscape={onClose}
          style={[
            styles.sheet,
            dialog ? styles.dialog : styles.bottom,
            {
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.borderSubtle,
              // O inset de baixo só vale para a folha presa embaixo
              paddingBottom: tokens.space[5] + (dialog ? 0 : insets.bottom),
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
  rootDialog: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.space[6],
  },
  sheet: {
    borderWidth: tokens.borderWidth.hair,
    paddingHorizontal: tokens.space[5],
    paddingTop: tokens.space[3],
  },
  bottom: {
    maxHeight: '90%',
    borderTopLeftRadius: tokens.radius.lg,
    borderTopRightRadius: tokens.radius.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    borderRadius: tokens.radius.lg,
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
