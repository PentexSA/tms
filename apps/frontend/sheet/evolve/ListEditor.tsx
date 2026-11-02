import { type ListItem, type ResolvedList, stored } from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  Pressable,
  Stepper,
  Text,
  TextArea,
  TextField,
  tokens,
  useTheme,
} from '@tms/ui'
import { useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import {
  describeItem,
  ItemLine,
  itemTitle,
  itemValue,
  ListHeader,
} from '../views/ListView'
import type { FieldViewProps } from '../views/types'
import { useFieldIssue, useSetDraft } from './hooks'
import { withItemDefaults } from './listItem'
import { fold, nextItemId, noneOf } from './text'

// list em Evoluir (DS: Repeater / ListEditor). O esquema do item vem do
// template (`item.value`, `specialty`, `notes`, `meta`): Disciplinas do
// Vampiro, magias do D&D, armas do CoC e façanhas do Fate usam o mesmo
// editor. O catálogo do template só tem nomes; texto livre vai até 80.

export const ITEM_NAME_MAX = 80
const NOTES_MAX = 2000
const META_TEXT_MAX = 80

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** A recusa da conta (ou do validador) para quem tocou; `null` se entrou. */
type Write = string | null

/** Item sem campos vazios: o validador do core recusa chave sem esquema. */
function cleanItem(item: ListItem): ListItem {
  const out: Mutable<ListItem> = { id: item.id }
  if (item.name?.trim()) out.name = item.name.trim()
  if (item.text !== undefined) out.text = item.text
  if (typeof item.value === 'number') out.value = item.value
  if (item.specialty?.trim()) out.specialty = item.specialty.trim()
  if (item.notes?.trim()) out.notes = item.notes.trim()
  if (item.meta) {
    const meta = Object.fromEntries(
      Object.entries(item.meta).filter(([, v]) => v !== '' && v !== undefined)
    )
    if (Object.keys(meta).length) out.meta = meta
  }
  return out
}

export function ListEditor({ resolved, sheet }: FieldViewProps) {
  const { colors } = useTheme()
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  if (resolved.type !== 'list') return null
  const list: ResolvedList = resolved
  const def = list.field.def
  const items = stored(list, sheet) as ListItem[]
  // A recusa volta para a folha que recebeu o toque (T-19): desenhada aqui,
  // embaixo da lista, ela ficava atrás do modal e sobrava ao fechar.
  const write = (next: readonly ListItem[]): Write =>
    set(`values.${list.id}`, next.map(cleanItem))
  const add = (name: string): Write => {
    const id = nextItemId(items)
    // Aspecto (Fate) é só texto; o resto tem nome e, se o esquema pede, valor
    const value = def.item.value
      ? Math.min(def.item.value.max, Math.max(def.item.value.min ?? 0, 1))
      : undefined
    // Com o mínimo dos metas numéricos: o valor que o editor mostra (T-23)
    const item = withItemDefaults(
      def,
      def.item.aspect ? { id, text: name } : { id, name, value }
    )
    const refused = write([...items, item])
    if (!refused) setAdding(false)
    return refused
  }
  const current = items.find(i => i.id === editing)
  const border = { borderBottomColor: colors.borderSubtle }
  return (
    <View testID={`editor-${list.id}`} style={styles.wrap}>
      <ListHeader resolved={list} sheet={sheet} />
      {list.items.map(item => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={describeItem(list, item)}
          accessibilityValue={
            itemValue(list, item) !== undefined
              ? { text: String(itemValue(list, item)) }
              : undefined
          }
          accessibilityHint="Abre o item"
          onPress={() => setEditing(item.id)}
          style={[styles.row, border]}
        >
          <ItemLine list={list} item={item} />
        </Pressable>
      ))}
      {!list.items.length ? (
        <Text color="inkMuted" style={styles.empty}>
          {noneOf(def.itemLabel)}
        </Text>
      ) : null}
      {issue ? (
        <Text
          variant="caption"
          color="danger"
          accessibilityRole="alert"
          style={styles.empty}
        >
          {issue}
        </Text>
      ) : null}
      {def.fixed ? null : (
        <View style={styles.add}>
          <Button
            title={`Adicionar ${def.itemLabel}`}
            variant="secondary"
            onPress={() => setAdding(true)}
          />
        </View>
      )}
      <AddItemSheet
        visible={adding}
        list={list}
        onClose={() => setAdding(false)}
        onAdd={add}
      />
      {current ? (
        <ItemSheet
          key={current.id}
          list={list}
          item={current}
          onClose={() => setEditing(null)}
          onSave={next => {
            const refused = write(items.map(i => (i.id === next.id ? next : i)))
            if (!refused) setEditing(null)
            return refused
          }}
          onRemove={() => {
            const refused = write(items.filter(i => i.id !== current.id))
            if (!refused) setEditing(null)
            return refused
          }}
        />
      ) : null}
    </View>
  )
}

/** A frase da recusa dentro da folha, perto do toque; o app a anuncia. */
function Refusal({
  message,
  testID,
}: {
  readonly message: string
  readonly testID: string
}) {
  return (
    <Text
      variant="caption"
      color="danger"
      accessibilityRole="alert"
      testID={testID}
    >
      {message}
    </Text>
  )
}

const announce = (message: string) =>
  AccessibilityInfo.announceForAccessibility(message)

function AddItemSheet({
  visible,
  list,
  onClose,
  onAdd,
}: {
  readonly visible: boolean
  readonly list: ResolvedList
  readonly onClose: () => void
  readonly onAdd: (name: string) => Write
}) {
  const [query, setQuery] = useState('')
  // Onde a recusa aparece: `option:<nome>` (a opção tocada) ou `custom`
  // (o botão do texto livre)
  const [refused, setRefused] = useState<{
    readonly at: string
    readonly message: string
  } | null>(null)
  const def = list.field.def
  const have = new Set(list.items.map(i => fold(itemTitle(list, i))))
  const q = fold(query)
  const options = (def.catalog ?? []).filter(name => fold(name).includes(q))
  const exact = (def.catalog ?? []).some(name => fold(name) === q)
  const custom = query.trim()
  // Recusado, o nome digitado fica (QAA-05); só limpa o que entrou
  const pick = (name: string, at: string) => {
    const message = onAdd(name)
    if (message) {
      setRefused({ at, message })
      announce(message)
      return
    }
    setQuery('')
    setRefused(null)
  }
  const refusalAt = (at: string) =>
    refused?.at === at ? (
      <Refusal message={refused.message} testID={`refusal-${list.id}`} />
    ) : null
  return (
    <BottomSheet
      visible={visible}
      title={`Adicionar ${def.itemLabel}`}
      testID={`add-sheet-${list.id}`}
      onClose={() => {
        setQuery('')
        setRefused(null)
        onClose()
      }}
    >
      <View style={styles.sheet}>
        <TextField
          label={def.catalog?.length ? `Buscar ${def.itemLabel}` : 'Nome'}
          value={query}
          onChangeText={text => {
            setQuery(text)
            setRefused(null)
          }}
          maxLength={ITEM_NAME_MAX}
          autoFocus
        />
        {options.map(name => {
          const taken = have.has(fold(name))
          return (
            <View key={name}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={taken ? `${name}, já na ficha` : name}
                disabled={taken}
                onPress={() => pick(name, `option:${name}`)}
                style={styles.option}
              >
                <Text>{name}</Text>
                {taken ? (
                  <Text variant="caption" color="inkMuted">
                    já na ficha
                  </Text>
                ) : null}
              </Pressable>
              {refusalAt(`option:${name}`)}
            </View>
          )
        })}
        {custom && !exact ? (
          <View style={styles.sheet}>
            <Button
              title={`Adicionar “${custom}”`}
              variant="secondary"
              onPress={() => pick(custom, 'custom')}
            />
            {refusalAt('custom')}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  )
}

function ItemSheet({
  list,
  item,
  onClose,
  onSave,
  onRemove,
}: {
  readonly list: ResolvedList
  readonly item: ListItem
  readonly onClose: () => void
  readonly onSave: (item: ListItem) => Write
  readonly onRemove: () => Write
}) {
  const def = list.field.def
  const schema = def.item
  // Item antigo sem meta: começa do que a folha mostra, e "Aplicar" o grava
  const [draft, setDraft] = useState<ListItem>(() =>
    withItemDefaults(def, item)
  )
  const [confirming, setConfirming] = useState(false)
  // A recusa fica na folha, acima do Aplicar, até o próximo ajuste (T-19)
  const [refused, setRefused] = useState<string | null>(null)
  const title = itemTitle(list, item) || def.itemLabel
  const patch = (p: Partial<Mutable<ListItem>>) => {
    setRefused(null)
    setDraft(d => ({ ...d, ...p }))
  }
  const attempt = (message: Write) => {
    setRefused(message)
    if (message) announce(message)
  }
  const refusal = refused ? (
    <Refusal message={refused} testID={`refusal-${list.id}`} />
  ) : null
  const footer = confirming ? (
    <>
      <Button
        title="Cancelar"
        variant="ghost"
        onPress={() => {
          setConfirming(false)
          setRefused(null)
        }}
      />
      <Button
        title="Remover"
        variant="danger"
        onPress={() => attempt(onRemove())}
      />
    </>
  ) : (
    <>
      {def.fixed ? null : (
        <Button
          title="Remover"
          variant="ghost"
          onPress={() => setConfirming(true)}
        />
      )}
      <Button title="Aplicar" onPress={() => attempt(onSave(draft))} />
    </>
  )
  return (
    <BottomSheet
      visible
      title={title}
      onClose={onClose}
      footer={footer}
      testID={`item-sheet-${list.id}`}
    >
      <View style={styles.sheet}>
        {confirming ? (
          <>
            <Text accessibilityRole="alert">{`Remover ${title}?`}</Text>
            {refusal}
          </>
        ) : (
          <>
            {def.fixed || schema.aspect ? (
              <TextField
                label={def.itemLabel}
                value={draft.text ?? ''}
                onChangeText={text => patch({ text })}
                maxLength={200}
              />
            ) : (
              <TextField
                label="Nome"
                value={draft.name ?? ''}
                onChangeText={name => patch({ name })}
                maxLength={ITEM_NAME_MAX}
              />
            )}
            {schema.value ? (
              <View style={styles.inline}>
                <Text style={styles.flex}>Valor</Text>
                <Stepper
                  label={`${title}, valor`}
                  value={draft.value ?? schema.value.min ?? 0}
                  min={schema.value.min ?? 0}
                  max={schema.value.max}
                  onChange={value => patch({ value })}
                  valueText={n => `${n} de ${schema.value?.max}`}
                />
              </View>
            ) : null}
            {(schema.meta ?? []).map(m =>
              m.type === 'number' ? (
                <View key={m.id} style={styles.inline}>
                  <Text style={styles.flex}>{m.label}</Text>
                  <Stepper
                    label={`${title}, ${m.label}`}
                    value={Number(draft.meta?.[m.id] ?? m.min ?? 0)}
                    min={m.min ?? -99}
                    max={m.max ?? 99}
                    onChange={n =>
                      patch({ meta: { ...draft.meta, [m.id]: n } })
                    }
                  />
                </View>
              ) : (
                <TextField
                  key={m.id}
                  label={m.label}
                  value={String(draft.meta?.[m.id] ?? '')}
                  onChangeText={v =>
                    patch({ meta: { ...draft.meta, [m.id]: v } })
                  }
                  maxLength={META_TEXT_MAX}
                />
              )
            )}
            {schema.specialty ? (
              <TextField
                label="Especialização"
                value={draft.specialty ?? ''}
                onChangeText={specialty => patch({ specialty })}
                maxLength={ITEM_NAME_MAX}
              />
            ) : null}
            {schema.notes ? (
              <TextArea
                label="Notas do jogador"
                value={draft.notes ?? ''}
                onChangeText={notes => patch({ notes })}
                maxLength={NOTES_MAX}
              />
            ) : null}
            {refusal}
          </>
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[3],
    minHeight: tokens.size.rowMin,
    paddingVertical: tokens.space[2],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  empty: {
    paddingHorizontal: tokens.layout.gutter,
    paddingTop: tokens.space[2],
  },
  add: {
    paddingHorizontal: tokens.layout.gutter,
    paddingVertical: tokens.space[2],
    alignItems: 'flex-start',
  },
  sheet: { gap: tokens.space[3] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space[2],
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  flex: { flex: 1 },
})
