import type { Href } from 'expo-router'
import { useBackTo } from '../lib/navigation'

// O "‹" da ficha (P09-C, T-39; com o T-81 do P11). Volta à tela de baixo,
// que no nativo continua montada (a crônica com a aba, a rolagem, os filtros
// e a seleção da Mesa), como o gesto de voltar do iOS e o voltar do Android.
// Sem tela de baixo (link direto, recarga no web), abre a crônica; sem
// crônica, a lista. "Anterior/Próxima" trocam de ficha com `replace`, então a
// tela de baixo de qualquer ficha aberta pela Mesa é sempre a crônica. Não
// usa `dismissTo`: ele volta à crônica com parâmetros novos e apagaria o
// `?view=`.

export interface SheetBack {
  readonly label: string
  readonly onPress: () => void
}

export function useSheetBack(
  chronicle: { readonly id: string; readonly name: string } | null
): SheetBack {
  const fallback = chronicle ? `/chronicles/${chronicle.id}` : '/'
  return {
    label: chronicle?.name ?? 'Crônicas',
    onPress: useBackTo(fallback as Href),
  }
}
