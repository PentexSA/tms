import {
  describe,
  identityOf,
  parseSheet,
  type SheetModel,
} from '@tms/sheet-core'
import {
  Avatar,
  Button,
  Pressable,
  Skeleton,
  Text,
  ThemeProvider,
  tokens,
  useTheme,
} from '@tms/ui'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { messageOf } from '../../lib/errors'
import { whenLabel } from '../../lib/format'
import { useChronicleTable } from '../../lib/queries/chronicles'
import { useRefetchOnFocus } from '../../lib/queries/focus'
import { SheetProvider } from '../../sheet/context'
import { useCompiled, useTemplate } from '../../sheet/data'
import { FieldSlot } from '../../sheet/FieldSlot'
import { createSheetStore, type SheetStore } from '../../sheet/store/sheetStore'

// A Mesa do narrador (doc/plano-v0.md, Etapa 19; design/telas/mesa.html): uma
// linha por personagem com os campos do dock do template, desenhados pelo
// registry na variante `chip`. Nada aqui conhece sistema: o Vampiro mostra
// Vitalidade, Sangue e Força de Vontade porque o template dele diz isso, e o
// D&D mostra PV, CA e espaços de magia pelo mesmo código.

export interface TableRowData {
  readonly id: string
  readonly name: string
  readonly owner: { readonly id: string; readonly username: string }
  readonly systemCode: string
  readonly templateVersion: string
  readonly sheetVersion: number
  readonly updatedAt: string | Date
  readonly sheet: unknown
}

/** Store só de leitura (sem fila) para desenhar o dock com o registry. */
function useRowStore(model: SheetModel | null | undefined, row: TableRowData) {
  return useMemo((): SheetStore | null => {
    if (!model) return null
    // O que vem da rede é input hostil: ficha que não valida não é desenhada
    const parsed = parseSheet(model, row.sheet)
    if (!parsed.ok) return null
    return createSheetStore({
      characterId: row.id,
      model,
      sheet: parsed.value,
      sheetVersion: row.sheetVersion,
      roles: ['storyteller'],
    })
  }, [model, row.id, row.sheet, row.sheetVersion])
}

function TableRow({ row }: { readonly row: TableRowData }) {
  const router = useRouter()
  const template = useTemplate(row.systemCode, row.templateVersion)
  const model = useCompiled(template.data)
  const store = useRowStore(model, row)
  const state = store?.getState()
  const identity = state ? identityOf(state.resolved) : null
  const dock = model?.template.dock ?? []
  const meta = `${row.owner.username} · alterada ${whenLabel(row.updatedAt)}`
  const status =
    model === null
      ? 'Atualize o app para ver esta ficha.'
      : template.isError
        ? messageOf(template.error)
        : model && !store
          ? 'Ficha com dados inválidos.'
          : null
  // O nome acessível da linha diz o que os chips mostram (a linha é um alvo só)
  const described = state
    ? dock
        .map(id => {
          const entry = state.entries.get(id)
          return entry ? describe(entry.resolved, entry.sheet) : null
        })
        .filter(Boolean)
    : []
  const label = [
    [row.name, identity?.chip].filter(Boolean).join(', '),
    ...described,
    status,
    meta,
  ]
    .filter(Boolean)
    .join('. ')

  return (
    <ThemeProvider accent={identity?.accent ?? 'accent-neutral'}>
      <RowBody
        label={label}
        onPress={() => router.push(`/characters/${row.id}`)}
      >
        <Avatar name={row.name} />
        <View style={styles.text}>
          <Text variant="fieldLabel" numberOfLines={2}>
            {row.name}
          </Text>
          {identity?.chip ? (
            <Text variant="caption" color="accent">
              {identity.chip}
            </Text>
          ) : null}
          <Text variant="caption" color="inkMuted">
            {meta}
          </Text>
          {status ? (
            <Text variant="caption" color="inkMuted">
              {status}
            </Text>
          ) : null}
          {store ? (
            <SheetProvider store={store}>
              <View style={styles.chips}>
                {dock.map(id => (
                  <FieldSlot key={id} id={id} variant="chip" />
                ))}
              </View>
            </SheetProvider>
          ) : template.isPending ? (
            <Skeleton lines={1} label="Carregando o dock" />
          ) : null}
        </View>
      </RowBody>
    </ThemeProvider>
  )
}

function RowBody({
  label,
  onPress,
  children,
}: {
  readonly label: string
  readonly onPress: () => void
  readonly children: React.ReactNode
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Abre a ficha em leitura"
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.borderSubtle }]}
    >
      {children}
    </Pressable>
  )
}

export function TableView({ chronicleId }: { readonly chronicleId: string }) {
  const table = useChronicleTable(chronicleId, true)
  useRefetchOnFocus(() => table.refetch({ cancelRefetch: false }))
  return (
    <View>
      <Text color="inkMuted" style={styles.hint}>
        Cada linha mostra os recursos do dock do sistema. Toque para abrir a
        ficha em leitura; editar como narrador fica assinado no histórico.
      </Text>
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
      ) : table.data.length === 0 ? (
        <Text color="inkMuted" style={styles.hint}>
          Nenhuma ficha na crônica ainda.
        </Text>
      ) : (
        table.data.map(row => (
          <TableRow key={row.id} row={row as TableRowData} />
        ))
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin + 16,
    paddingVertical: tokens.space[3],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  text: { flex: 1, gap: tokens.space[1] },
  chips: { gap: tokens.space[1], marginTop: tokens.space[1] },
  hint: {
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
    gap: tokens.space[2],
  },
})
