import { useContext } from 'react'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

// Safe area sem exigir o provider (testes e telas isoladas): sem ele, zero.
export function useInsets() {
  return (
    useContext(SafeAreaInsetsContext) ?? {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    }
  )
}
