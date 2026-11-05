import { type ListItem, type ResolvedList, stored } from '@tms/sheet-core'
import {
  BottomSheet,
  Button,
  HelpButton,
  HelpText,
  Pressable,
  Stepper,
  type StepperIncrease,
  Text,
  TextArea,
  TextField,
  tokens,
  useHelp,
  useTheme,
} from '@tms/ui'
import { type ReactNode, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSheetStore } from '../context'
import { useStepAdvice } from '../creation/useStepAdvice'
import { useHeadedList } from '../layouts/headedList'
import {
  describeItem,
  ItemLine,
  itemTitle,
  itemValue,
  ListHeader,
} from '../views/ListView'
import type { FieldViewProps } from '../views/types'
import { DraftNoticeText } from './DraftNoticeText'
import { fieldHelp } from './EditorShell'
import { useDraftNotice, useFieldIssue, useSetDraft } from './hooks'
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

/**
 * O aviso do toque recusado na lista (o do store, R-20) e como apagá-lo. O
 * store não vê o rascunho local da folha: a folha apaga o aviso quando muda
 * o que estava tentando e ao fechar, para ele não sobrar na ficha.
 */
function useListNotice(list: ResolvedList) {
  const store = useSheetStore()
  const notice = useDraftNotice(`values.${list.id}`)
  // Só o aviso desta lista: o de outra linha da ficha (um Atributo) fica
  const clear = () => {
    if (notice) store.getState().clearNotice()
  }
  const text = notice ? (
    <DraftNoticeText notice={notice} field={list.id} />
  ) : null
  return { notice, text, clear }
}

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
  // O cabeçalho do bloco já diz o nome e a conta da lista (T-58)
  const headed = useHeadedList(resolved.id)
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
      {headed ? null : <EditorListHeader list={list} sheet={sheet} />}
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

// O cabeçalho da lista no Editar e na criação, com o "?" da frase do campo
// (R-19) ao lado. Quando o título do bloco já nomeia a lista (T-58), o "?" vai
// nele (layouts/groupHelp.tsx).
function EditorListHeader({
  list,
  sheet,
}: {
  readonly list: ResolvedList
  readonly sheet: FieldViewProps['sheet']
}) {
  const state = useHelp()
  const help = fieldHelp(list.field.def)
  if (!help) return <ListHeader resolved={list} sheet={sheet} />
  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <ListHeader resolved={list} sheet={sheet} />
        </View>
        <HelpButton
          subject={help.subject}
          expanded={state.expanded}
          onToggle={state.toggle}
          controls={state.textId}
          testID={`editor-${list.id}-help`}
        />
      </View>
      {state.expanded ? (
        <View style={styles.headerHelp}>
          <HelpText id={state.textId} text={help.text} />
        </View>
      ) : null}
    </View>
  )
}

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
  // Onde o aviso da recusa aparece (T-19): `option:<nome>` (a opção tocada),
  // `custom` (o botão do texto livre) ou `field` (o Enter no campo). O texto
  // é o do store (useDraftNotice), que some quando a causa some
  const [at, setAt] = useState<string | null>(null)
  // Por que o Enter não adicionou (sugestões à vista, nome já na ficha)
  const [guide, setGuide] = useState<string | null>(null)
  const notice = useListNotice(list)
  const def = list.field.def
  const have = new Set(list.items.map(i => fold(itemTitle(list, i))))
  const match = (text: string) => {
    const q = fold(text)
    return {
      options: (def.catalog ?? []).filter(name => fold(name).includes(q)),
      exact: (def.catalog ?? []).find(name => fold(name) === q),
      custom: text.trim(),
    }
  }
  const { options, exact, custom } = match(query)
  // Recusado, o nome digitado fica (QAA-05); só limpa o que entrou
  const pick = (name: string, where: string) => {
    setGuide(null)
    if (onAdd(name)) {
      setAt(where)
      return
    }
    setQuery('')
    setAt(null)
  }
  // Enter (web) e "✓" (teclado do app) fazem o que o botão à vista faria
  // (T-62): o nome exato do catálogo adiciona o item do catálogo; sem
  // catálogo, ou sem sugestão, o texto livre. Com sugestões à vista, o Enter
  // não adiciona "Domi" como Disciplina: o campo diz o que tocar.
  const explain = (message: string) => {
    notice.clear()
    setAt(null)
    setGuide(message)
  }
  // O texto que chega com o Enter, não o do estado: no app, o "✓" pode vir
  // antes do último onChangeText (digitação rápida, sugestão do teclado), e
  // o nome entraria cortado ("Ambi" no lugar de "Ambidestro")
  const submit = (text: string) => {
    const { options, exact, custom } = match(text)
    if (!custom) return
    if (exact && have.has(fold(exact)))
      return explain(`${exact} já está na ficha.`)
    if (exact) return pick(exact, 'field')
    if (!options.length) return pick(custom, 'field')
    explain(
      `Toque numa sugestão, ou em “Adicionar “${custom}”” para usar o nome como está.`
    )
  }
  const noticeAt = (where: string) => (at === where ? notice.text : null)
  return (
    <BottomSheet
      visible={visible}
      title={`Adicionar ${def.itemLabel}`}
      testID={`add-sheet-${list.id}`}
      onClose={() => {
        setQuery('')
        setAt(null)
        setGuide(null)
        notice.clear()
        onClose()
      }}
    >
      <View style={styles.sheet}>
        <TextField
          label={def.catalog?.length ? `Buscar ${def.itemLabel}` : 'Nome'}
          value={query}
          onChangeText={text => {
            setQuery(text)
            setAt(null)
            setGuide(null)
            notice.clear()
          }}
          maxLength={ITEM_NAME_MAX}
          autoFocus
          // Recusado pelo Enter, o aviso é o erro do próprio campo (marcado
          // inválido e ligado à frase), com o foco nele
          error={guide ?? (at === 'field' ? notice.notice?.text : null)}
          returnKeyType="done"
          submitBehavior="submit"
          {...(Platform.OS === 'web' ? { blurOnSubmit: false } : {})}
          onSubmitEditing={e => submit(e?.nativeEvent?.text ?? query)}
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
              {noticeAt(`option:${name}`)}
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
            {noticeAt('custom')}
          </View>
        ) : null}
      </View>
    </BottomSheet>
  )
}

/**
 * A previsão do "+" do Valor (R-20, T-19, antes do toque): a trava ou o
 * custo do próximo ponto do item, pelo `useStepAdvice` do caminho do item.
 * A previsão é do valor que o store tem: com o Valor já mudado na folha, ela
 * não vale mais, e o toque decide (o "Aplicar" passa pela conta exata). O
 * "+" bloqueado continua tocável, como nas linhas (`Stepper.increase`).
 */
function useItemAdvice(
  list: ResolvedList,
  item: ListItem,
  draft: ListItem,
  refused: boolean
): { readonly stepper?: StepperIncrease; readonly note: ReactNode } {
  const advice = useStepAdvice(`values.${list.id}#${item.id}`)
  const min = list.field.def.item.value?.min ?? 0
  const fresh = (draft.value ?? min) === (item.value ?? min)
  // Sem Valor no item (Dons do W20: um ponto por item), não há "+" a prever
  if (!advice || !fresh || !list.field.def.item.value) return { note: null }
  // Com o aviso aberto, o aviso fala pelo motivo
  const id = `advice-${list.id}-${item.id}`
  const written = !refused && advice.text ? advice.text : null
  return {
    stepper: {
      blocked: advice.blocked !== null,
      hint: advice.text,
      // Com o aviso aberto, o "+" aponta o aviso, como nas linhas
      hintID: refused ? `notice-${list.id}` : written ? id : null,
    },
    note: written ? (
      <Text variant="caption" color="inkMuted" nativeID={id} testID={id}>
        {written}
      </Text>
    ) : null,
  }
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
  readonly onSave: (item: ListItem) => void
  readonly onRemove: () => void
}) {
  const def = list.field.def
  const schema = def.item
  // Item antigo sem meta: começa do que a folha mostra, e "Aplicar" o grava
  const [draft, setDraft] = useState<ListItem>(() =>
    withItemDefaults(def, item)
  )
  const [confirming, setConfirming] = useState(false)
  // O aviso do store fica na folha, acima do Aplicar (ou sob "Remover X?"),
  // até o próximo ajuste (T-19)
  const notice = useListNotice(list)
  const title = itemTitle(list, item) || def.itemLabel
  const patch = (p: Partial<Mutable<ListItem>>) => {
    notice.clear()
    setDraft(d => ({ ...d, ...p }))
  }
  const refusal = notice.text
  const increase = useItemAdvice(list, item, draft, refusal !== null)
  const footer = confirming ? (
    <>
      <Button
        title="Cancelar"
        variant="ghost"
        onPress={() => {
          setConfirming(false)
          notice.clear()
        }}
      />
      <Button title="Remover" variant="danger" onPress={onRemove} />
    </>
  ) : (
    <>
      {def.fixed ? null : (
        <Button
          title="Remover"
          variant="ghost"
          onPress={() => {
            // A recusa do Aplicar não vale para a remoção
            notice.clear()
            setConfirming(true)
          }}
        />
      )}
      <Button title="Aplicar" onPress={() => onSave(draft)} />
    </>
  )
  return (
    <BottomSheet
      visible
      title={title}
      onClose={() => {
        notice.clear()
        onClose()
      }}
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
                  increase={increase.stepper}
                />
              </View>
            ) : null}
            {increase.note}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: tokens.layout.gutter,
  },
  headerHelp: { paddingHorizontal: tokens.layout.gutter },
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
