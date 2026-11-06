import { type Href, useRouter } from 'expo-router'
import { useCallback } from 'react'

// O "‹" que sempre sai (P12, T-30). `router.back()` sem tela de baixo (F5 no
// web, link direto) manda um GO_BACK que nenhum navegador trata, e o botão
// não faz nada. Com tela de baixo, volta a ela (que no nativo continua
// montada); sem, abre `fallback` com `replace`. Nunca `replace` quando há
// tela de baixo: a pilha ficaria com duas listas, e o voltar do Android
// pediria um toque a mais (achado 6 da onda 3).

export function useBackTo(fallback: Href): () => void {
  const router = useRouter()
  return useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(fallback)
  }, [router, fallback])
}
