import { useQueries, useQueryClient } from '@tanstack/react-query'
import type { SheetModel } from '@tms/sheet-core'
import {
  Button,
  Chip,
  Skeleton,
  TabPanel,
  Tabs,
  Text,
  tokens,
  useLayout,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import { hhmm } from '../../lib/format'
import {
  type TableScope,
  useChronicleTable,
} from '../../lib/queries/chronicles'
import { useRefetchOnFocus } from '../../lib/queries/focus'
import { rollKeys } from '../../lib/queries/rolls'
import { useChronicleXpRequests } from '../../lib/queries/xp'
import { useTableOrder } from '../../lib/tableOrder'
import { compileSafe, templateQuery } from '../../sheet/data'
import { RollFeed } from './RollFeed'
import { TableRow } from './TableRow'
import { useTableSelection } from './TableSelection'
import {
  arrange,
  buildItem,
  type TableItem,
  type TableRowData,
  type TableSort,
} from './tableItems'
import { XpRequestsSheet } from './XpSheets'

// A Mesa do narrador (doc/plano-v0.md, Etapa 19; doc/plano-v3.md, Etapa 9;
// design/telas/mesa.html): uma linha por personagem com o dock e os alertas
// do template. Nada aqui conhece sistema: o Vampiro mostra Vitalidade, Sangue
// e Força de Vontade porque o template dele diz isso, e o D&D mostra PV, CA e
// espaços de magia pelo mesmo código. Mostra as fichas em jogo; as
// arquivadas e fora de jogo vêm pelo filtro, do servidor.

export type { TableRowData } from './tableItems'

// T-48 (P09-C): a Mesa em grade nas telas largas. Cada cartão pede ~340 de
// largura; até 3 colunas, na largura do conteúdo (limitada a 1200 pelo
// Screen), menos as margens. Com fonte grande ou tela estreita (`stacked`),
// uma coluna.
export const TABLE_CARD_MIN = 340
export const TABLE_COLUMNS_MAX = 3

export function tableColumns(width: number, stacked: boolean): number {
  if (stacked) return 1
  const usable =
    Math.min(width, tokens.layout.contentMaxExpanded) - 2 * tokens.layout.gutter
  return Math.max(
    1,
    Math.min(TABLE_COLUMNS_MAX, Math.floor(usable / TABLE_CARD_MIN))
  )
}

/**
 * As linhas da grade, na ordem da lista: a leitura e o Tab seguem linha a
 * linha. A última linha completa com espaços vazios, para os cartões terem a
 * mesma largura.
 */
function TableGrid({
  items,
  columns,
  renderItem,
}: {
  readonly items: readonly TableItem[]
  readonly columns: number
  readonly renderItem: (item: TableItem, framed: boolean) => ReactNode
}) {
  if (columns <= 1) return <>{items.map(i => renderItem(i, false))}</>
  const rows: TableItem[][] = []
  for (let i = 0; i < items.length; i += columns)
    rows.push(items.slice(i, i + columns))
  return (
    <View style={styles.grid} testID="table-grid">
      {rows.map((row, r) => (
        <View
          key={row[0]?.row.id ?? r}
          style={styles.gridRow}
          testID={`table-grid-row-${r}`}
        >
          {row.map(item => (
            <View key={item.row.id} style={styles.cell}>
              {renderItem(item, true)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, k) => (
            <View key={`empty-${k}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  )
}

// Sem resposta ainda: o mesmo array vazio a cada render, para os itens (e a
// seleção, que os recebe) não mudarem à toa
const NO_ROWS: readonly TableRowData[] = []

// Fora do componente: com a mesma função, o TanStack não refaz o array
const dataOf = (results: readonly { readonly data: unknown }[]) =>
  results.map(r => r.data)

/** Os modelos das versões de template das linhas, carregados de uma vez. */
function useModels(rows: readonly TableRowData[]) {
  const keys = useMemo(
    () => [
      ...new Map(
        rows.map(r => [
          `${r.systemCode}@${r.templateVersion}`,
          [r.systemCode, r.templateVersion] as const,
        ])
      ).values(),
    ],
    [rows]
  )
  // `combine` devolve o mesmo array enquanto nenhum template muda
  const data = useQueries({
    queries: keys.map(([code, version]) => templateQuery(code, version)),
    combine: dataOf,
  })
  // O mapa só muda quando um template chega: as linhas continuam iguais
  return useMemo(() => {
    const out = new Map<string, SheetModel | null | undefined>()
    keys.forEach(([code, version], i) => {
      out.set(`${code}@${version}`, compileSafe(data[i]))
    })
    return out
  }, [keys, data])
}

/** Os itens da Mesa, reaproveitando o de cada linha que não mudou. */
function useItems(rows: readonly TableRowData[]): TableItem[] {
  const models = useModels(rows)
  const cache = useRef(new Map<string, TableItem>())
  return useMemo(() => {
    const next = new Map<string, TableItem>()
    const items = rows.map(row => {
      const model = models.get(`${row.systemCode}@${row.templateVersion}`)
      const old = cache.current.get(row.id)
      const item =
        old && old.row === row && old.model === model
          ? old
          : buildItem(row, model)
      next.set(row.id, item)
      return item
    })
    cache.current = next
    return items
  }, [rows, models])
}

/** "Atualizado agora", "há 2 min": o relógio anda sozinho a cada 30 s. */
function UpdatedAt({ at }: { readonly at: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [at])
  if (!at) return null
  const minutes = Math.floor((now - at) / 60_000)
  const text =
    minutes < 1
      ? 'Atualizado agora'
      : minutes < 60
        ? `Atualizado há ${minutes} min`
        : `Atualizado às ${hhmm(new Date(at))}`
  return (
    <Text variant="caption" color="inkMuted" testID="table-updated">
      {text}
    </Text>
  )
}

export function TableView({ chronicleId }: { readonly chronicleId: string }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const remember = useTableOrder(s => s.remember)
  const [scope, setScope] = useState<TableScope>('playing')
  const [sort, setSort] = useState<TableSort>('name')
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const { width, stacked } = useLayout()
  const columns = tableColumns(width, stacked)
  // A seleção vive na crônica (T-49): a barra fica fora da rolagem
  const selection = useTableSelection()
  const { selecting, selected, toggle: select, sync } = selection
  const [requests, setRequests] = useState(false)
  const xpRequests = useChronicleXpRequests(chronicleId)
  const table = useChronicleTable(chronicleId, true, scope)
  useRefetchOnFocus(() => {
    void queryClient.invalidateQueries({ queryKey: rollKeys.feed(chronicleId) })
    // T-40: o pedido de XP feito com a crônica aberta aparece na volta
    void xpRequests.refetch({ cancelRefetch: false })
    return table.refetch({ cancelRefetch: false })
  })
  const rows = (table.data ?? NO_ROWS) as TableRowData[]
  const items = useItems(rows)
  // A barra sabe o que está marcado pelos itens da Mesa
  useEffect(() => sync(items), [items, sync])
  const shown = useMemo(
    () => arrange(items, { sort, onlyAlerts }),
    [items, sort, onlyAlerts]
  )
  // A ordem da tela, lida ao abrir: o callback não muda com o filtro, e as
  // linhas não redesenham por causa dele
  const order = useRef<readonly string[]>([])
  order.current = shown.map(i => i.row.id)
  const open = useCallback(
    (id: string) => {
      remember(chronicleId, order.current)
      router.push(`/characters/${id}`)
    },
    [chronicleId, remember, router]
  )

  return (
    <View>
      <View style={styles.controls}>
        <Tabs
          id="table-scope"
          size="sm"
          accessibilityLabel="Fichas da Mesa"
          items={[
            { id: 'playing', label: 'Em jogo' },
            { id: 'out', label: 'Arquivadas e fora de jogo' },
          ]}
          selected={scope}
          onSelect={id => {
            setScope(id as TableScope)
            selection.clear()
          }}
        />
        <View style={styles.chips}>
          <Chip
            label="Nome"
            selected={sort === 'name'}
            accessibilityLabel="Ordenar por nome"
            onPress={() => setSort('name')}
          />
          <Chip
            label="Última alteração"
            selected={sort === 'updated'}
            accessibilityLabel="Ordenar pela última alteração"
            onPress={() => setSort('updated')}
          />
          <Chip
            label="Só com alerta"
            selected={onlyAlerts}
            onPress={() => setOnlyAlerts(v => !v)}
          />
        </View>
        <UpdatedAt at={table.dataUpdatedAt} />
        {xpRequests.data?.length ? (
          <Button
            title={`Pedidos de XP (${xpRequests.data.length})`}
            variant="secondary"
            testID="table-xp-requests"
            onPress={() => setRequests(true)}
          />
        ) : null}
        {/* Mesa vazia: nada a selecionar (NW-17). A contagem e as ações
            ficam na barra fixa embaixo (T-49) */}
        {rows.length || selecting ? (
          <Button
            title={selecting ? 'Cancelar seleção' : 'Selecionar personagens'}
            variant="secondary"
            onPress={selecting ? selection.stop : selection.start}
          />
        ) : null}
      </View>
      <TabPanel tabsId="table-scope" tab={scope}>
        {table.isPending ? (
          <Skeleton lines={3} label="Carregando a mesa" />
        ) : table.isError ? (
          <View style={styles.hint}>
            <Text color="danger">{messageOf(table.error)}</Text>
            <Button
              title="Tentar de novo"
              variant="secondary"
              onPress={() => table.refetch()}
            />
          </View>
        ) : shown.length === 0 ? (
          <Text color="inkMuted" style={styles.hint}>
            {onlyAlerts && rows.length
              ? 'Ninguém com alerta agora.'
              : scope === 'out'
                ? 'Nenhuma ficha arquivada ou fora de jogo.'
                : 'Nenhuma ficha na crônica ainda.'}
          </Text>
        ) : (
          <TableGrid
            items={shown}
            columns={columns}
            renderItem={(item, framed) => (
              <TableRow
                key={item.row.id}
                item={item}
                onOpen={open}
                selecting={selecting}
                selected={selected.has(item.row.id)}
                onSelect={select}
                framed={framed}
              />
            )}
          />
        )}
      </TabPanel>
      {requests ? (
        <XpRequestsSheet
          chronicleId={chronicleId}
          onClose={() => setRequests(false)}
        />
      ) : null}
      <RollFeed chronicleId={chronicleId} />
    </View>
  )
}

const styles = StyleSheet.create({
  controls: {
    gap: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  hint: {
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
    gap: tokens.space[2],
  },
  grid: {
    gap: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
  },
  gridRow: { flexDirection: 'row', gap: tokens.space[3] },
  cell: { flex: 1, minWidth: 0 },
})
