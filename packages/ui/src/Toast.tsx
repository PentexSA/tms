import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native'
import { useInsets } from './insets'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Aviso curto com ação (o "Desfazer" de toda alteração em Jogo, DS §8.2).
// É anunciado ao leitor de tela e dura mais quando ele está ligado.

export interface ToastMessage {
  readonly message: string
  readonly action?: { readonly label: string; readonly onPress: () => void }
  readonly durationMs?: number
}

interface ToastApi {
  show(toast: ToastMessage): void
  hide(): void
}

const ToastContext = createContext<ToastApi | null>(null)

interface ToastLayerApi {
  readonly toast: ToastMessage | null
  readonly hide: () => void
  readonly modals: readonly string[]
  readonly setModal: (id: string, active: boolean) => void
}
const ToastLayerContext = createContext<ToastLayerApi | null>(null)

export const TOAST_MS = 5000
export const TOAST_SCREEN_READER_MS = 10000

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [modals, setModals] = useState<readonly string[]>([])
  const setModal = useCallback((id: string, active: boolean) => {
    setModals(current =>
      active
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.includes(id)
          ? current.filter(x => x !== id)
          : current
    )
  }, [])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reader = useRef(false)

  useEffect(() => {
    let alive = true
    Promise.resolve(AccessibilityInfo.isScreenReaderEnabled())
      .then(on => {
        if (alive) reader.current = Boolean(on)
      })
      .catch(() => undefined)
    return () => {
      alive = false
      clearTimeout(timer.current)
    }
  }, [])

  const hide = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])
  const show = useCallback(
    (next: ToastMessage) => {
      clearTimeout(timer.current)
      setToast(next)
      AccessibilityInfo.announceForAccessibility(next.message)
      const ms =
        next.durationMs ?? (reader.current ? TOAST_SCREEN_READER_MS : TOAST_MS)
      timer.current = setTimeout(hide, ms)
    },
    [hide]
  )
  const api = useMemo(() => ({ show, hide }), [show, hide])
  const layer = useMemo(
    () => ({ toast, hide, modals, setModal }),
    [toast, hide, modals, setModal]
  )

  return (
    <ToastContext.Provider value={api}>
      <ToastLayerContext.Provider value={layer}>
        {children}
        {toast && modals.length === 0 ? (
          <ToastView toast={toast} onDone={hide} />
        ) : null}
      </ToastLayerContext.Provider>
    </ToastContext.Provider>
  )
}

/** RN Modal tem uma janela acima da raiz do app. O aviso acompanha o modal
 * superior e volta à raiz quando ele fecha, com o mesmo prazo e a mesma ação. */
export function ModalToastHost({ visible }: { readonly visible: boolean }) {
  const layer = useContext(ToastLayerContext)
  const id = useId()
  const setModal = layer?.setModal
  const active = visible && Platform.OS !== 'web'
  useEffect(() => {
    if (!active || !setModal) return
    setModal(id, true)
    return () => setModal(id, false)
  }, [active, id, setModal])
  if (!active || !layer?.toast || layer.modals.at(-1) !== id) return null
  return <ToastView toast={layer.toast} onDone={layer.hide} />
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast precisa de um ToastProvider')
  return api
}

function ToastView({
  toast,
  onDone,
}: {
  readonly toast: ToastMessage
  readonly onDone: () => void
}) {
  const { colors } = useTheme()
  const insets = useInsets()
  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: tokens.space[4] + insets.bottom }]}
    >
      <View
        aria-live="polite"
        style={[
          styles.toast,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.borderSubtle,
          },
        ]}
      >
        <Text style={styles.message}>{toast.message}</Text>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.action.label}
            onPress={() => {
              // Fecha antes: a ação pode mostrar outro aviso, que fica
              onDone()
              toast.action?.onPress()
            }}
            style={styles.action}
          >
            <Text variant="fieldLabel" color="action">
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    maxWidth: 560,
    marginHorizontal: tokens.layout.gutter,
    paddingLeft: tokens.space[4],
    paddingRight: tokens.space[2],
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.hair,
  },
  message: { flexShrink: 1, paddingVertical: tokens.space[3] },
  action: { justifyContent: 'center', paddingHorizontal: tokens.space[2] },
})
