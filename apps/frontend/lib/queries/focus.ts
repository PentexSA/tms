import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

/**
 * Rebusca a cada foco da tela, inclusive ao montar de novo com o cache ainda
 * "fresco" (sem tempo real, doc/arquitetura §6.6). Quem chama passa um refetch
 * que não cancela o pedido em voo (`cancelRefetch: false`): na montagem a
 * query já está buscando e o foco não duplica a requisição.
 *
 * No web, também o foco da janela (T-06): duas janelas lado a lado não
 * disparam `visibilitychange`, e quem volta à janela da ficha vê o que o
 * narrador fez na outra. Só enquanto a tela está em foco.
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const latest = useRef(refetch)
  latest.current = refetch
  useFocusEffect(
    useCallback(() => {
      void latest.current()
      const page = globalThis as {
        addEventListener?: (type: 'focus', listener: () => void) => void
        removeEventListener?: (type: 'focus', listener: () => void) => void
      }
      if (Platform.OS !== 'web' || !page.addEventListener) return
      const onFocus = () => {
        void latest.current()
      }
      page.addEventListener('focus', onFocus)
      return () => page.removeEventListener?.('focus', onFocus)
    }, [])
  )
}

/**
 * "Puxar para atualizar" (P09-C, T-40): `refreshing` liga só durante o
 * puxão, até as rebuscas responderem, e não a cada rebusca de fundo (o
 * indicador não pisca com o foco). Nenhum intervalo: só o gesto.
 */
export function usePullRefresh(...refetches: (() => unknown)[]): {
  readonly refreshing: boolean
  readonly onRefresh: () => Promise<void>
} {
  const [refreshing, setRefreshing] = useState(false)
  const latest = useRef(refetches)
  latest.current = refetches
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.allSettled(latest.current.map(r => r()))
    } finally {
      if (alive.current) setRefreshing(false)
    }
  }, [])
  return { refreshing, onRefresh }
}
