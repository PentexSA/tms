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
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import { useInsets } from './insets'
import { Pressable } from './Pressable'
import { Text } from './Text'
import { useTheme } from './theme'
import { tokens } from './tokens'

// Aviso curto com ação (o "Desfazer" de toda alteração em Jogo, DS §8.2).
// É anunciado ao leitor de tela e dura mais quando ele está ligado.
//
// T-76 (P09-C): o prazo pausa enquanto há ponteiro em cima (web), foco dentro
// (teclado) ou toque no aviso (nativo), e volta com o que faltava, nunca
// menos de TOAST_RESUME_MIN_MS. Com leitor de tela, o prazo nunca fica abaixo
// de TOAST_SCREEN_READER_MS, mesmo com `durationMs` menor. Uma barra fixa
// embaixo (a da seleção da Mesa) ergue o aviso com `useToastOffset`, o
// `--dock-offset` do DS.

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

// O que segura o prazo: cada motivo liga e desliga sozinho
type HoldReason = 'pointer' | 'focus' | 'touch'

interface ToastLayerApi {
  readonly toast: ToastMessage | null
  readonly hide: () => void
  readonly hold: (reason: HoldReason, on: boolean) => void
  readonly modals: readonly string[]
  readonly setModal: (id: string, active: boolean) => void
  // A maior altura registrada por useToastOffset
  readonly offset: number
  readonly setOffset: (id: string, height: number | null) => void
}
const ToastLayerContext = createContext<ToastLayerApi | null>(null)

export const TOAST_MS = 5000
export const TOAST_SCREEN_READER_MS = 10000
// Depois de soltar, o aviso fica pelo menos isto, para dar tempo de tocar
export const TOAST_RESUME_MIN_MS = 2000

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
  const [offsets, setOffsets] = useState<Readonly<Record<string, number>>>({})
  const setOffset = useCallback((id: string, height: number | null) => {
    setOffsets(current => {
      if (height === null) {
        if (!(id in current)) return current
        const { [id]: _, ...rest } = current
        return rest
      }
      return current[id] === height ? current : { ...current, [id]: height }
    })
  }, [])
  const offset = Math.max(0, ...Object.values(offsets))
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const reader = useRef(false)
  // O prazo corrente: quando acaba e, pausado, quanto faltava
  const deadline = useRef(0)
  const remaining = useRef(0)
  const holds = useRef(new Set<HoldReason>())
  const shown = useRef(false)

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
    holds.current.clear()
    shown.current = false
    setToast(null)
  }, [])
  const arm = useCallback(
    (ms: number) => {
      clearTimeout(timer.current)
      deadline.current = Date.now() + ms
      timer.current = setTimeout(hide, ms)
    },
    [hide]
  )
  const show = useCallback(
    (next: ToastMessage) => {
      holds.current.clear()
      shown.current = true
      setToast(next)
      AccessibilityInfo.announceForAccessibility(next.message)
      const base = next.durationMs ?? TOAST_MS
      // O leitor de tela precisa de tempo para ler e chegar à ação
      arm(reader.current ? Math.max(base, TOAST_SCREEN_READER_MS) : base)
    },
    [arm]
  )
  const hold = useCallback(
    (reason: HoldReason, on: boolean) => {
      if (!shown.current) return
      const set = holds.current
      if (on) {
        if (set.has(reason)) return
        if (set.size === 0) {
          remaining.current = Math.max(0, deadline.current - Date.now())
          clearTimeout(timer.current)
        }
        set.add(reason)
        return
      }
      if (!set.delete(reason) || set.size > 0) return
      arm(Math.max(remaining.current, TOAST_RESUME_MIN_MS))
    },
    [arm]
  )
  const api = useMemo(() => ({ show, hide }), [show, hide])
  const layer = useMemo(
    () => ({ toast, hide, hold, modals, setModal, offset, setOffset }),
    [toast, hide, hold, modals, setModal, offset, setOffset]
  )

  return (
    <ToastContext.Provider value={api}>
      <ToastLayerContext.Provider value={layer}>
        {children}
        {toast && modals.length === 0 ? (
          <ToastView
            toast={toast}
            onDone={hide}
            onHold={hold}
            offset={offset}
          />
        ) : null}
      </ToastLayerContext.Provider>
    </ToastContext.Provider>
  )
}

/**
 * RN Modal tem uma janela acima da raiz do app; no web, o Modal do
 * react-native-web é um portal depois da raiz, e o aviso da raiz ficaria
 * embaixo dele (P12, T-43). Nas três plataformas, o aviso acompanha o modal
 * superior, dentro do painel (e do foco preso do aria-modal), e volta à raiz
 * quando ele fecha, com o mesmo prazo e a mesma ação. `offset` ergue o aviso
 * acima do rodapé da folha.
 */
export function ModalToastHost({
  visible,
  offset = 0,
}: {
  readonly visible: boolean
  readonly offset?: number
}) {
  const layer = useContext(ToastLayerContext)
  const id = useId()
  const setModal = layer?.setModal

  useEffect(() => {
    if (!visible || !setModal) return
    setModal(id, true)
    return () => setModal(id, false)
  }, [visible, id, setModal])
  if (!visible || !layer?.toast || layer.modals.at(-1) !== id) return null
  // Dentro do modal, a barra fixa da tela fica atrás: só o rodapé da folha
  return (
    <ToastView
      toast={layer.toast}
      onDone={layer.hide}
      onHold={layer.hold}
      offset={Math.max(0, offset)}
    />
  )
}

/**
 * Enquanto montado, ergue o aviso `height` dp acima do fundo da tela (o
 * `--dock-offset` do DS), para ele não cobrir uma barra fixa embaixo. Com
 * vários, vale o maior. Fora do ToastProvider, não faz nada.
 */
export function useToastOffset(height: number): void {
  const setOffset = useContext(ToastLayerContext)?.setOffset
  const id = useId()
  useEffect(() => {
    if (!setOffset) return
    setOffset(id, Math.max(0, height))
    return () => setOffset(id, null)
  }, [setOffset, id, height])
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast precisa de um ToastProvider')
  return api
}

function ToastView({
  toast,
  onDone,
  onHold,
  offset,
}: {
  readonly toast: ToastMessage
  readonly onDone: () => void
  readonly onHold: (reason: HoldReason, on: boolean) => void
  readonly offset: number
}) {
  const { colors } = useTheme()
  const insets = useInsets()
  // Saiu da tela com o ponteiro, o foco ou o dedo em cima (o aviso passou
  // para um modal, por exemplo): o leave, o blur e o touchEnd não chegam, e
  // o prazo ficaria parado para sempre. Solta tudo ao desmontar
  useEffect(
    () => () => {
      onHold('pointer', false)
      onHold('focus', false)
      onHold('touch', false)
    },
    [onHold]
  )
  return (
    <View
      pointerEvents="box-none"
      testID="toast-host"
      style={[
        styles.host,
        { bottom: tokens.space[4] + insets.bottom + offset },
      ]}
    >
      <View
        aria-live="polite"
        testID="toast"
        // O prazo pausa enquanto se interage com o aviso (T-76)
        onPointerEnter={() => onHold('pointer', true)}
        onPointerLeave={() => onHold('pointer', false)}
        onFocus={() => onHold('focus', true)}
        onBlur={() => onHold('focus', false)}
        onTouchStart={() => onHold('touch', true)}
        onTouchEnd={() => onHold('touch', false)}
        onTouchCancel={() => onHold('touch', false)}
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
