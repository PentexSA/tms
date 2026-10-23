import { useQueries, useQueryClient } from '@tanstack/react-query'
import { type SheetModel, type TemplateRecovery } from '@tms/sheet-core'
import { Button, Chip, Skeleton, Tabs, Text, tokens } from '@tms/ui'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import { hhmm } from '../../lib/format'
import { useOnline } from '../../lib/network'
import {
  type TableScope,
  useChronicleTable,
} from '../../lib/queries/chronicles'
import { useRefetchOnFocus } from '../../lib/queries/focus'
import { rollKeys } from '../../lib/queries/rolls'
import { useChronicleXpRequests } from '../../lib/queries/xp'
import { useTableOrder } from '../../lib/tableOrder'
import { compileSafe, templateQuery } from '../../sheet/data'
import { OperationSheet } from './OperationSheet'
import { RollFeed } from './RollFeed'
import { TableRow } from './TableRow'
import {
  arrange,
  buildItem,
  type TableItem,
  type TableRowData,
  type TableSort,
} from './tableItems'
import { GrantXpSheet, grantable, XpRequestsSheet } from './XpSheets'

// A Mesa do narrador (doc/plano-v0.md, Etapa 19; doc/plano-v3.md, Etapa 9;
// design/telas/mesa.html): uma linha por personagem com o dock e os alertas
// do template. Nada aqui conhece sistema: o Vampiro mostra Vitalidade, Sangue
// e Força de Vontade porque o template dele diz isso, e o D&D mostra PV, CA e
// espaços de magia pelo mesmo código. Mostra as fichas em jogo; as
// arquivadas e fora de jogo vêm pelo filtro, do servidor.

export type { TableRowData } from './tableItems'

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
  const online = useOnline()
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [operation, setOperation] = useState<{
    kind: 'damage' | 'heal' | 'recovery'
    recovery?: TemplateRecovery
    items: readonly TableItem[]
  } | null>(null)
  const [xpSheet, setXpSheet] = useState<'grant' | 'requests' | null>(null)
  const xpRequests = useChronicleXpRequests(chronicleId)
  const select = useCallback(
    (id: string) =>
      setSelected(old => {
        const next = new Set(old)
        if (next.has(id)) next.delete(id)
        else if (next.size < 20) next.add(id)
        return next
      }),
    []
  )
  const table = useChronicleTable(chronicleId, true, scope)
  useRefetchOnFocus(() => {
    void queryClient.invalidateQueries({ queryKey: rollKeys.feed(chronicleId) })
    return table.refetch({ cancelRefetch: false })
  })
  const rows = (table.data ?? []) as TableRowData[]
  const items = useItems(rows)
  const chosen = useMemo(
    () => items.filter(i => selected.has(i.row.id)),
    [items, selected]
  )
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
          size="sm"
          accessibilityLabel="Fichas da Mesa"
          items={[
            { id: 'playing', label: 'Em jogo' },
            { id: 'out', label: 'Arquivadas e fora de jogo' },
          ]}
          selected={scope}
          onSelect={id => {
            setScope(id as TableScope)
            setSelected(new Set())
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
            onPress={() => setXpSheet('requests')}
          />
        ) : null}
        <Button
          title={selecting ? 'Cancelar seleção' : 'Selecionar personagens'}
          variant="secondary"
          onPress={() => {
            setSelecting(v => !v)
            setSelected(new Set())
          }}
        />
        {selecting ? (
          <View style={styles.hint}>
            <Text>{chosen.length} de 20 selecionados</Text>
            <View style={styles.chips}>
              <Button
                title="Aplicar dano"
                disabled={!online || !chosen.length}
                onPress={() => setOperation({ kind: 'damage', items: chosen })}
              />
              <Button
                title="Curar"
                variant="secondary"
                disabled={!online || !chosen.length}
                onPress={() => setOperation({ kind: 'heal', items: chosen })}
              />
              <Button
                title="Conceder XP"
                variant="secondary"
                testID="table-xp-grant"
                disabled={!online || !grantable(chosen)}
                onPress={() => setXpSheet('grant')}
              />
              {(chosen[0]?.model?.template.recoveries ?? [])
                .filter(r =>
                  chosen.every(i =>
                    i.model?.template.recoveries?.some(
                      other => other.id === r.id
                    )
                  )
                )
                .map(recovery => (
                  <Button
                    key={recovery.id}
                    title={recovery.label}
                    variant="secondary"
                    disabled={!online}
                    onPress={() =>
                      setOperation({
                        kind: 'recovery',
                        recovery,
                        items: chosen,
                      })
                    }
                  />
                ))}
            </View>
            {!online ? (
              <Text color="inkMuted">
                Conecte-se para aplicar uma operação em grupo.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
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
        shown.map(item => (
          <TableRow
            key={item.row.id}
            item={item}
            onOpen={open}
            selecting={selecting}
            selected={selected.has(item.row.id)}
            onSelect={select}
          />
        ))
      )}
      {xpSheet === 'grant' ? (
        <GrantXpSheet
          chronicleId={chronicleId}
          items={chosen}
          onClose={() => setXpSheet(null)}
        />
      ) : null}
      {xpSheet === 'requests' ? (
        <XpRequestsSheet
          chronicleId={chronicleId}
          onClose={() => setXpSheet(null)}
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
})
