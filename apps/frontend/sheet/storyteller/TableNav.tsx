import { Button, Text, tokens, useTheme } from '@tms/ui'
import { useRouter } from 'expo-router'
import { type ReactNode, useMemo, useRef } from 'react'
import {
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'

import { neighborsOf, swipeTo, useTableOrder } from '../../lib/tableOrder'

// Navegar entre as fichas da Mesa sem voltar a ela (doc/plano-v3.md, Etapa 9;
// C-19 do avaliacao-ui-ux.md): deslizar passa para a próxima, na ordem que a
// Mesa mostrava. Os botões fazem o mesmo para quem não desliza (leitor de
// tela, teclado, mouse).

function useNeighbors(characterId: string) {
  const ids = useTableOrder(s => s.ids)
  return useMemo(() => neighborsOf(ids, characterId), [ids, characterId])
}

export function TableNav({ characterId }: { readonly characterId: string }) {
  const router = useRouter()
  const { colors } = useTheme()
  const { prev, next, position, total } = useNeighbors(characterId)
  if (!position || total < 2) return null
  const go = (id: string | null) => {
    if (id) router.replace(`/characters/${id}`)
  }
  return (
    <View
      role="navigation"
      aria-label="Fichas da Mesa"
      style={[styles.bar, { borderBottomColor: colors.borderSubtle }]}
    >
      <Button
        title="‹ Anterior"
        variant="ghost"
        disabled={!prev}
        accessibilityHint="Abre a ficha anterior da Mesa"
        onPress={() => go(prev)}
      />
      <Text variant="caption" color="inkMuted">
        {`${position} de ${total} na Mesa`}
      </Text>
      <Button
        title="Próxima ›"
        variant="ghost"
        disabled={!next}
        accessibilityHint="Abre a próxima ficha da Mesa"
        onPress={() => go(next)}
      />
    </View>
  )
}

/** A área da ficha que aceita o gesto de passar para a ficha vizinha. */
export function SwipeArea({
  characterId,
  children,
}: {
  readonly characterId: string
  readonly children: ReactNode
}) {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const neighbors = useNeighbors(characterId)
  // O PanResponder é criado uma vez; o que muda vem das refs
  const latest = useRef({ neighbors, width })
  latest.current = { neighbors, width }
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          swipeTo(g, latest.current.width) !== null,
        onPanResponderRelease: (_, g) => {
          const { neighbors: n, width: w } = latest.current
          const to = swipeTo(g, w)
          const id = to === 'next' ? n.next : to === 'prev' ? n.prev : null
          if (id) router.replace(`/characters/${id}`)
        },
      }),
    [router]
  )
  if (!neighbors.position) return <>{children}</>
  return (
    <View style={styles.area} {...pan.panHandlers}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  area: { flex: 1 },
})
