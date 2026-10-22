import type { SheetModel } from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  EmptyState,
  Skeleton,
  Text,
  tokens,
  useTheme,
} from '@tms/ui'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { useRevertOperation } from '../../components/chronicles/useRevertOperation'
import { messageOf } from '../../lib/errors'
import { whenLabel } from '../../lib/format'
import { useOnline } from '../../lib/network'
import { useCharacterHistory } from '../../lib/queries/history'

// "Histórico de alterações" (doc/plano-v0.md, Etapa 19; design/telas/
// prototipo.js openHistory): quem, quando e o que mudou, do mais novo ao mais
// antigo. O servidor já tirou o que o papel não lê, e texto vem só como
// "atualizado", sem conteúdo.

export interface HistoryItem {
  readonly id: string
  readonly at: string | Date
  // Null: a conta de quem alterou foi excluída (o histórico fica, anônimo)
  readonly by: { readonly username: string } | null
  readonly byRole: string
  readonly operationId?: string | null
  readonly reversible?: boolean
  readonly changes: readonly {
    readonly label: string
    readonly change: string
  }[]
}

export const DELETED_ACCOUNT = 'Conta excluída'

export const whoLabel = (item: Pick<HistoryItem, 'by' | 'byRole'>) =>
  `${item.by?.username ?? DELETED_ACCOUNT}${
    item.byRole === 'storyteller' ? ' (narrador)' : ''
  }`

function HistoryRow({
  item,
  undo,
  disabled,
}: {
  readonly item: HistoryItem
  readonly undo?: () => void
  readonly disabled: boolean
}) {
  const { colors } = useTheme()
  const lines = item.changes.map(c => `${c.label}: ${c.change}`)
  const meta = `${whenLabel(item.at)} · ${whoLabel(item)}`
  return (
    <View style={[styles.row, { borderBottomColor: colors.borderSubtle }]}>
      <View accessible accessibilityLabel={`${lines.join('; ')}. ${meta}`}>
        {lines.map(line => (
          <Text key={line}>{line}</Text>
        ))}
        <Text variant="caption" color="inkMuted">
          {meta}
        </Text>
      </View>
      {undo ? (
        <Button
          title="Desfazer"
          variant="ghost"
          disabled={disabled}
          onPress={undo}
        />
      ) : null}
    </View>
  )
}

export function HistorySheet({
  characterId,
  chronicleId,
  characterName,
  model,
  storyteller,
  visible,
  onClose,
}: {
  readonly characterId: string
  readonly chronicleId: string
  readonly characterName: string
  readonly model: SheetModel
  readonly storyteller: boolean
  readonly visible: boolean
  readonly onClose: () => void
}) {
  const history = useCharacterHistory(characterId, visible)
  const online = useOnline()
  const characters = useMemo(
    () => new Map([[characterId, { name: characterName, model }]]),
    [characterId, characterName, model]
  )
  const { revert, pending } = useRevertOperation(chronicleId, characters)
  const items = (history.data?.pages.flatMap(p => p.items) ??
    []) as HistoryItem[]
  let body: React.JSX.Element
  if (history.isPending)
    body = <Skeleton lines={4} label="Carregando o histórico" />
  else if (history.isError && !history.data)
    body = (
      <View style={styles.gap}>
        <Text color="danger">{messageOf(history.error)}</Text>
        <Button
          title="Tentar de novo"
          variant="secondary"
          onPress={() => history.refetch()}
        />
      </View>
    )
  else if (!items.length && !history.hasNextPage)
    body = (
      <EmptyState
        title="Nenhuma alteração ainda"
        message="Cada alteração aparece aqui com quem fez e quando."
      />
    )
  else
    body = (
      <View>
        {items.map(item => (
          <HistoryRow
            key={item.id}
            item={item}
            disabled={!online || pending}
            undo={
              storyteller && item.reversible
                ? () => {
                    void revert({ revertsBatchId: item.id })
                  }
                : undefined
            }
          />
        ))}
        {storyteller && !online ? (
          <Text color="inkMuted">Conecte-se para desfazer uma operação.</Text>
        ) : null}
        {history.hasNextPage ? (
          <View style={styles.more}>
            <Button
              title="Carregar mais"
              variant="secondary"
              busy={history.isFetchingNextPage}
              onPress={() => history.fetchNextPage()}
            />
          </View>
        ) : null}
      </View>
    )
  return (
    <BottomSheet
      visible={visible}
      title="Histórico de alterações"
      onClose={onClose}
    >
      {body}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  row: {
    gap: tokens.space[1],
    paddingVertical: tokens.space[3],
    borderBottomWidth: tokens.borderWidth.hair,
  },
  more: { paddingVertical: tokens.space[3] },
  gap: { gap: tokens.space[2] },
})
