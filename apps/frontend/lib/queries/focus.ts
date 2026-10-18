import { useFocusEffect } from 'expo-router'
import { useCallback, useRef } from 'react'

/**
 * Rebusca a cada foco da tela, inclusive ao montar de novo com o cache ainda
 * "fresco" (sem tempo real, doc/arquitetura §6.6). Quem chama passa um refetch
 * que não cancela o pedido em voo (`cancelRefetch: false`): na montagem a
 * query já está buscando e o foco não duplica a requisição.
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const latest = useRef(refetch)
  latest.current = refetch
  useFocusEffect(
    useCallback(() => {
      void latest.current()
    }, [])
  )
}
