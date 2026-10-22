import { damageTargets } from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  Chip,
  Stepper,
  Text,
  tokens,
  useToast,
} from '@tms/ui'
import { randomUUID } from 'expo-crypto'
import { useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { messageOf, statusOf } from '../../lib/errors'
import { useOnline } from '../../lib/network'
import {
  type DamageRequest,
  type OperationPreview,
  previewOperation,
  useRunOperation,
} from '../../lib/queries/operations'
import type { TableItem } from './tableItems'
import { useRevertOperation } from './useRevertOperation'

/** A mesma folha para trilhas e recursos: alvos, tipos e rótulos vêm do template. */
export function OperationSheet({
  chronicleId,
  items,
  kind,
  onClose,
}: {
  readonly chronicleId: string
  readonly items: readonly TableItem[]
  readonly kind: 'damage' | 'heal'
  readonly onClose: () => void
}) {
  const online = useOnline()
  const toast = useToast()
  const run = useRunOperation(chronicleId)
  const characters = useMemo(
    () =>
      new Map(
        items.map(i => [
          i.row.id,
          {
            name: i.row.name,
            model: i.model,
          },
        ])
      ),
    [items]
  )
  const { revert } = useRevertOperation(chronicleId, characters)
  const [amount, setAmount] = useState(1)
  const [type, setType] = useState<string>()
  const [fields, setFields] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<readonly OperationPreview[] | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const key = useRef<string | null>(null)
  const sending = useRef(false)
  const targets = items.map(i => {
    const available = i.model ? damageTargets(i.model) : []
    return {
      item: i,
      available,
      field:
        fields[i.row.id] ??
        (available.length === 1 ? available[0]?.id : undefined),
    }
  })
  const types = [
    ...new Map(
      targets.flatMap(t => {
        const def = t.available.find(f => f.id === t.field)?.def
        return def?.type === 'track'
          ? (def.types ?? []).map(x => [x.id, x] as const)
          : []
      })
    ).values(),
  ]
  const selectedType = types.some(t => t.id === type) ? type : types[0]?.id
  const body: DamageRequest = {
    kind,
    amount,
    ...(selectedType && { type: selectedType }),
    targets: targets.map(t => ({
      characterId: t.item.row.id,
      ...(t.field && { field: t.field }),
    })),
  }
  const busy = loading || run.isPending
  const clear = () => {
    setPreview(null)
    setError(null)
    key.current = null
  }
  const readPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      setPreview(await previewOperation(chronicleId, body))
      key.current = null
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setLoading(false)
    }
  }
  const confirm = async () => {
    if (!preview || sending.current || !online) return
    sending.current = true
    key.current ??= randomUUID()
    setError(null)
    try {
      const result = await run.mutateAsync({
        ...body,
        clientOperationId: key.current,
        targets: body.targets.map(t => ({
          ...t,
          sheetVersion: preview.find(p => p.characterId === t.characterId)!
            .sheetVersion,
        })),
      })
      onClose()
      toast.show({
        message: `${kind === 'damage' ? 'Dano aplicado' : 'Cura aplicada'} em ${items.length} ${items.length === 1 ? 'personagem' : 'personagens'}.`,
        action: {
          label: 'Desfazer',
          onPress: () => {
            void revert({ revertsOperationId: result.operationId })
          },
        },
      })
    } catch (e) {
      const value = (e as { value?: { preview?: OperationPreview[] } })?.value
      if (statusOf(e) === 409 && value?.preview) {
        setPreview(value.preview)
        key.current = null
        setError('A mesa mudou. Confira a nova prévia e confirme de novo.')
      } else {
        if (value?.preview) setPreview(value.preview)
        setError(messageOf(e))
      }
    } finally {
      sending.current = false
    }
  }

  return (
    <BottomSheet
      visible
      title={kind === 'damage' ? 'Aplicar dano em grupo' : 'Curar em grupo'}
      onClose={() => {
        if (!busy) onClose()
      }}
      footer={
        <Button
          title={preview ? 'Confirmar operação' : 'Ver prévia'}
          busy={busy}
          disabled={
            !online ||
            items.some(i => !i.model) ||
            (preview !== null && preview.some(p => !p.ok))
          }
          onPress={() => {
            void (preview ? confirm() : readPreview())
          }}
        />
      }
    >
      <View style={styles.content}>
        <Text color="inkMuted">
          {items.length} {items.length === 1 ? 'personagem' : 'personagens'} ·
          confira cada ficha antes de confirmar.
        </Text>
        <Stepper
          label="Quantidade"
          value={amount}
          min={1}
          max={50}
          size="sheet"
          testID="operation-amount"
          disabled={busy}
          onChange={v => {
            setAmount(v)
            clear()
          }}
        />
        {targets
          .filter(t => t.available.length > 1)
          .map(t => (
            <View key={t.item.row.id} style={styles.content}>
              <Text variant="fieldLabel">
                Onde aplicar em {t.item.row.name}
              </Text>
              <View style={styles.chips}>
                {t.available.map(f => (
                  <Chip
                    key={f.id}
                    label={f.def.label}
                    selected={t.field === f.id}
                    onPress={
                      busy
                        ? undefined
                        : () => {
                            setFields(old => ({
                              ...old,
                              [t.item.row.id]: f.id,
                            }))
                            clear()
                          }
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        {types.length ? (
          <View style={styles.chips}>
            {types.map(t => (
              <Chip
                key={t.id}
                label={t.label}
                selected={selectedType === t.id}
                onPress={
                  busy
                    ? undefined
                    : () => {
                        setType(t.id)
                        clear()
                      }
                }
              />
            ))}
          </View>
        ) : null}
        {!online ? (
          <Text color="inkMuted">
            Conecte-se para aplicar uma operação em grupo.
          </Text>
        ) : null}
        {error ? (
          <Text color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {preview
          ? preview.map(p => (
              <View
                key={p.characterId}
                style={styles.preview}
                testID={`operation-preview-${p.characterId}`}
              >
                <Text variant="fieldLabel">{p.name}</Text>
                {p.ok ? (
                  p.changes?.map((c, i) => (
                    <Text key={`${c.label}-${i}`}>
                      {c.label}: {c.change}
                    </Text>
                  ))
                ) : (
                  <Text color="danger">{p.reason}</Text>
                )}
              </View>
            ))
          : items.map(i => <Text key={i.row.id}>{i.row.name}</Text>)}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  content: { gap: tokens.space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
  preview: { gap: tokens.space[1], paddingVertical: tokens.space[2] },
})
