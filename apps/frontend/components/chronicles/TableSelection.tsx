import type { TemplateRecovery } from '@tms/sheet-core'
import {
  Button,
  Text,
  tokens,
  useLayout,
  useTheme,
  useToastOffset,
} from '@tms/ui'
import { useFocusEffect } from 'expo-router'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'

import { useOnline } from '../../lib/network'
import { OperationSheet } from './OperationSheet'
import type { TableItem } from './tableItems'
import { GrantXpSheet, grantable } from './XpSheets'

// A seleção da Mesa e a barra fixa das operações em grupo (P09-C: T-49,
// T-75). A seleção vive na tela da crônica, não na Mesa: a barra fica fora da
// rolagem (sempre à vista, acima da safe area), e a seleção continua quando
// o narrador volta de uma ficha. É estado de tela: morre com ela, e nenhum
// dado de ficha fica em memória depois de sair.

// O mesmo limite do servidor (MAX_TARGETS, apps/api/src/chronicles/
// operations.ts), que é quem decide: aqui só se explica o limite
export const TABLE_SELECTION_MAX = 20
export const SELECTION_FULL = `Máximo de ${TABLE_SELECTION_MAX} por operação.`

/** "1 selecionado (máx. 20)": o 20 é o limite, não o total da Mesa (T-75). */
export function selectionLabel(n: number): string {
  const max = `(máx. ${TABLE_SELECTION_MAX})`
  if (n <= 0) return `Nenhum selecionado ${max}`
  return n === 1 ? `1 selecionado ${max}` : `${n} selecionados ${max}`
}

const NONE: ReadonlySet<string> = new Set()

export interface TableSelection {
  readonly selecting: boolean
  readonly selected: ReadonlySet<string>
  // As fichas marcadas, entre as que a Mesa mostra agora
  readonly chosen: readonly TableItem[]
  // O último toque passou do limite (até o próximo toque ou limpar)
  readonly full: boolean
  readonly start: () => void
  readonly stop: () => void
  readonly clear: () => void
  readonly toggle: (id: string) => void
  // A Mesa informa os itens dela (para a barra saber o que está marcado)
  readonly sync: (items: readonly TableItem[]) => void
}

const SelectionContext = createContext<TableSelection | null>(null)

export function useTableSelection(): TableSelection {
  const value = useContext(SelectionContext)
  if (!value)
    throw new Error('useTableSelection precisa de um TableSelectionProvider')
  return value
}

export function TableSelectionProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(NONE)
  const [items, setItems] = useState<readonly TableItem[]>([])
  const [full, setFull] = useState(false)
  // A seleção corrente entre dois toques do mesmo render
  const current = useRef(selected)
  current.current = selected
  const choose = useCallback((next: ReadonlySet<string>) => {
    current.current = next
    setSelected(next)
  }, [])
  const clear = useCallback(() => {
    choose(NONE)
    setFull(false)
  }, [choose])
  const start = useCallback(() => {
    clear()
    setSelecting(true)
  }, [clear])
  const stop = useCallback(() => {
    clear()
    setSelecting(false)
  }, [clear])
  const toggle = useCallback(
    (id: string) => {
      const old = current.current
      if (!old.has(id) && old.size >= TABLE_SELECTION_MAX) {
        // O 21º toque não marca, e agora explica
        setFull(true)
        return
      }
      const next = new Set(old)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      choose(next)
      setFull(false)
    },
    [choose]
  )
  // Só troca quando a lista muda de fato. A ficha que saiu da Mesa
  // (arquivada, excluída, outro recorte) sai da seleção: a contagem e o
  // limite de 20 contam só o que está na tela
  const sync = useCallback(
    (next: readonly TableItem[]) => {
      setItems(old =>
        old.length === next.length && old.every((item, i) => item === next[i])
          ? old
          : next
      )
      const shown = new Set(next.map(i => i.row.id))
      const kept = [...current.current].filter(id => shown.has(id))
      if (kept.length !== current.current.size) choose(new Set(kept))
    },
    [choose]
  )
  const chosen = useMemo(
    () => items.filter(i => selected.has(i.row.id)),
    [items, selected]
  )
  const value = useMemo(
    () => ({
      selecting,
      selected,
      chosen,
      full,
      start,
      stop,
      clear,
      toggle,
      sync,
    }),
    [selecting, selected, chosen, full, start, stop, clear, toggle, sync]
  )
  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

type Operation = {
  readonly kind: 'damage' | 'heal' | 'recovery'
  readonly recovery?: TemplateRecovery
  readonly items: readonly TableItem[]
}

/**
 * A barra da seleção, irmã da rolagem da crônica: a contagem, "Limpar
 * seleção" e as ações em grupo, sempre à vista (T-49). As ações abrem as
 * mesmas folhas de antes, com prévia e "Confirmar operação". Abaixo de 600,
 * os botões ficam numa linha com rolagem lateral; a partir de 600, quebram
 * em linhas. O aviso de "Desfazer" sobe acima dela (useToastOffset).
 */
export function TableActionBar({
  chronicleId,
}: {
  readonly chronicleId: string
}) {
  const selection = useTableSelection()
  const { chosen, selecting, full } = selection
  const online = useOnline()
  const { colors } = useTheme()
  const wide = useLayout().breakpoint !== 'compact'
  const [operation, setOperation] = useState<Operation | null>(null)
  const [granting, setGranting] = useState(false)
  const [height, setHeight] = useState(0)
  useToastOffset(selecting ? height : 0)
  // O voltar do Android desliga a seleção antes de sair da crônica, como a
  // barra de ação contextual. Só no Android (no web o BackHandler não
  // existe e loga erro; o iOS não tem o botão), só com a barra à vista (a
  // aba Mesa) e com a tela em foco: em outra aba, ou com uma ficha aberta
  // por cima, o voltar é o de sempre
  const stop = selection.stop
  useFocusEffect(
    useCallback(() => {
      if (!selecting || Platform.OS !== 'android') return
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        stop()
        return true
      })
      return () => sub.remove()
    }, [selecting, stop])
  )
  const sheets = (
    <>
      {granting ? (
        <GrantXpSheet
          chronicleId={chronicleId}
          items={chosen}
          onClose={() => setGranting(false)}
        />
      ) : null}
      {operation ? (
        <OperationSheet
          chronicleId={chronicleId}
          items={operation.items}
          kind={operation.kind}
          recovery={operation.recovery}
          onClose={() => setOperation(null)}
        />
      ) : null}
    </>
  )
  if (!selecting) return sheets
  // As recuperações do template comuns a todas as marcadas
  const recoveries = (chosen[0]?.model?.template.recoveries ?? []).filter(r =>
    chosen.every(i =>
      i.model?.template.recoveries?.some(other => other.id === r.id)
    )
  )
  const none = !chosen.length
  const actions = (
    <>
      <Button
        title="Aplicar dano"
        disabled={!online || none}
        onPress={() => setOperation({ kind: 'damage', items: chosen })}
      />
      <Button
        title="Curar"
        variant="secondary"
        disabled={!online || none}
        onPress={() => setOperation({ kind: 'heal', items: chosen })}
      />
      <Button
        title="Conceder XP"
        variant="secondary"
        testID="table-xp-grant"
        disabled={!online || !grantable(chosen)}
        onPress={() => setGranting(true)}
      />
      {recoveries.map(recovery => (
        <Button
          key={recovery.id}
          title={recovery.label}
          variant="secondary"
          disabled={!online || none}
          onPress={() =>
            setOperation({ kind: 'recovery', recovery, items: chosen })
          }
        />
      ))}
    </>
  )
  return (
    <>
      <View
        role="toolbar"
        aria-label="Ações da seleção"
        testID="table-action-bar"
        onLayout={e => setHeight(e.nativeEvent.layout.height)}
        style={[
          styles.bar,
          {
            backgroundColor: colors.surfaceRaised,
            borderTopColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.status}>
          <Text
            aria-live="polite"
            testID="table-selection-count"
            style={styles.count}
          >
            {selectionLabel(chosen.length)}
          </Text>
          <Button
            title="Limpar seleção"
            variant="ghost"
            disabled={none}
            onPress={selection.clear}
          />
        </View>
        {full ? (
          <Text
            accessibilityRole="alert"
            color="danger"
            testID="table-selection-full"
          >
            {SELECTION_FULL}
          </Text>
        ) : null}
        {wide ? (
          <View style={styles.wrap}>{actions}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.line}
            keyboardShouldPersistTaps="handled"
          >
            {actions}
          </ScrollView>
        )}
        {!online ? (
          <Text color="inkMuted">
            Conecte-se para aplicar uma operação em grupo.
          </Text>
        ) : null}
      </View>
      {sheets}
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
    borderTopWidth: tokens.borderWidth.hair,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[2],
  },
  count: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  line: { flexDirection: 'row', gap: tokens.space[2] },
})
