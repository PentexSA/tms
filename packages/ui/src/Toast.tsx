import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
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

export const TOAST_MS = 5000
export const TOAST_SCREEN_READER_MS = 10000

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null)
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

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView toast={toast} onDone={hide} /> : null}
    </ToastContext.Provider>
  )
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
        accessibilityLiveRegion="polite"
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
              toast.action?.onPress()
              onDone()
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
