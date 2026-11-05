import {
  editClass,
  type ListItem,
  type ListItemSchema,
  type ListMeta,
  type ResolvedList,
  stored,
} from '@tms/sheet-core'
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
  WithHelp,
} from '@tms/ui'
import { type ReactNode, useMemo, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { useSheet, useSheetSelector, useSheetStore } from '../context'
import { addAdvice, metaAdvice } from '../creation/creation'
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
import {
  useClassNote,
  useDraftNotice,
  useFieldIssue,
  useSetDraft,
} from './hooks'
import { withCatalogDefaults, withItemDefaults } from './listItem'
import {
  badgeText,
  chooseText,
  type IdentityAdvice,
  itemAdviceLines,
  itemLabels,
  useIdentityAdvice,
} from './recommend'
import { byLabel, fold, nextItemId, noneOf } from './text'
import { useRowFeedback } from './useRowFeedback'

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
  const { model } = useSheet()
  const store = useSheetStore()
  // O selo da identidade e os avisos da criação (D-07, D-09)
  // Pelo store: a prop `sheet` fica velha quando só a identidade muda
  const identity = useIdentityAdvice(resolved.id)
  const set = useSetDraft()
  const issue = useFieldIssue(resolved.id)
  // Ficha ativa: mudar o valor do item é evolução e pede o narrador, como
  // nas linhas de traço (a lista em si é edição: nome e notas seguem livres)
  const blocked = useClassNote(
    editClass(resolved.field) === 'play' ? 'play' : 'advance'
  )
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  // O cabeçalho do bloco já diz o nome e a conta da lista (T-58)
  const headed = useHeadedList(resolved.id)
  if (resolved.type !== 'list') return null
  const list: ResolvedList = resolved
  const def = list.field.def
  const items = stored(list, sheet) as ListItem[]
  // A recusa volta para a folha que recebeu o toque (T-19): desenhada aqui,
  // embaixo da lista, ela ficava atrás do modal e sobrava ao fechar. O −/+
  // da linha manda o `at` do item, e a recusa volta para a linha (R-25)
  const write = (next: readonly ListItem[], at?: string): Write =>
    set(`values.${list.id}`, next.map(cleanItem), at ? { at } : undefined)
  const step = (item: ListItem, value: number) =>
    write(
      items.map(i => (i.id === item.id ? { ...i, value } : i)),
      `values.${list.id}#${item.id}`
    )
  // O aviso de um −/+ recusado é da linha: a folha que abre não o herda
  const open = (id: string) => {
    store.getState().clearNotice()
    setEditing(id)
  }
  const add = (name: string): Write => {
    const id = nextItemId(items)
    // Aspecto (Fate) é só texto; o resto tem nome e, se o esquema pede, valor
    const value = def.item.value
      ? Math.min(def.item.value.max, Math.max(def.item.value.min ?? 0, 1))
      : undefined
    // Com o meta do catálogo (o Posto do Dom, T-24) e o mínimo dos metas
    // numéricos: o valor que o editor mostra (T-23)
    const item = withItemDefaults(
      def,
      withCatalogDefaults(
        def,
        def.item.aspect ? { id, text: name } : { id, name, value }
      )
    )
    const refused = write([...items, item])
    if (!refused) setAdding(false)
    return refused
  }
  const current = items.find(i => i.id === editing)
  const border = { borderBottomColor: colors.borderSubtle }
  const badge = (item: ListItem) =>
    badgeText(itemLabels(identity, itemTitle(list, item)))
  // O nome acessível leva o selo: "Potência, 2 de 5, do clã"
  const label = (item: ListItem) =>
    [describeItem(list, item), badge(item)].filter(Boolean).join(', ')
  const below = (item: ListItem) => (
    <IdentityLines
      field={`${list.id}-${item.id}`}
      badge={badge(item)}
      lines={itemAdviceLines(model, list.id, item, identity)}
    />
  )
  return (
    <View testID={`editor-${list.id}`} style={styles.wrap}>
      {headed ? null : <EditorListHeader list={list} sheet={sheet} />}
      {blocked && def.item.value ? (
        <Text variant="caption" color="inkMuted" style={styles.empty}>
          {blocked}
        </Text>
      ) : null}
      {list.items.map(item =>
        def.item.value ? (
          <ItemEditorRow
            key={item.id}
            list={list}
            item={item}
            schema={def.item.value}
            label={label(item)}
            blocked={blocked !== null}
            onOpen={() => open(item.id)}
            onStep={value => step(item, value)}
            below={below(item)}
          />
        ) : (
          <View key={item.id} style={[styles.plain, border]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label(item)}
              accessibilityValue={
                itemValue(list, item) !== undefined
                  ? { text: String(itemValue(list, item)) }
                  : undefined
              }
              accessibilityHint="Abre o item"
              onPress={() => open(item.id)}
              style={styles.row}
            >
              <ItemLine list={list} item={item} />
            </Pressable>
            {below(item)}
          </View>
        )
      )}
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
        identity={identity}
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
  return (
    <WithHelp
      help={fieldHelp(list.field.def)}
      fill
      testID={`editor-${list.id}-help`}
      style={styles.headerRow}
      textStyle={styles.headerHelp}
    >
      <ListHeader resolved={list} sheet={sheet} />
    </WithHelp>
  )
}

/** O selo e os avisos da identidade sob o nome do item (R-26, T-24). */
function IdentityLines({
  field,
  badge,
  lines,
}: {
  readonly field: string
  readonly badge: string
  readonly lines: readonly string[]
}) {
  if (!badge && !lines.length) return null
  return (
    <View testID={`identity-${field}`} style={styles.identity}>
      {badge ? (
        <Text variant="caption" color="inkMuted">
          {badge}
        </Text>
      ) : null}
      {lines.map(line => (
        <Text key={line} variant="caption" color="inkMuted">
          {line}
        </Text>
      ))}
    </View>
  )
}

// Com o catálogo maior que isto, a folha sem busca mostra só as
// recomendadas, e o resto pela busca (um Modal com 100 botões no Android)
const OTHERS_MAX = 40

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface OptionBlock {
  readonly key: string
  readonly title: string | null
  readonly names: readonly string[]
}

/**
 * As opções da folha em blocos (R-26): as recomendadas pela identidade
 * primeiro, com o título da fonte ("Do clã"; com mais de uma fonte, "Da Raça
 * · Lupino"), e depois as outras. Com busca, as que casam, recomendadas na
 * frente. Dentro de cada bloco, a ordem do template (o P10-C ordena pelo
 * rótulo no rebase).
 */
function optionBlocks(
  // O catálogo na ordem do rótulo (byLabel, P10-C)
  catalog: readonly string[],
  identity: IdentityAdvice,
  query: string,
  options: readonly string[]
): readonly OptionBlock[] {
  const { recommend, recommended } = identity
  if (!recommend || !recommended.size)
    return [{ key: 'all', title: null, names: options }]
  if (query.trim()) {
    const first = options.filter(n => recommended.has(n))
    const rest = options.filter(n => !recommended.has(n))
    return [{ key: 'search', title: null, names: [...first, ...rest] }]
  }
  const seen = new Set<string>()
  const blocks: OptionBlock[] = []
  // As fontes do core (recommendedBySource): a mesma regra do selo
  for (const source of identity.sources) {
    if (!source.option) continue
    const names = catalog.filter(n => source.names.includes(n) && !seen.has(n))
    for (const n of names) seen.add(n)
    if (!names.length) continue
    const title = capitalize(source.label)
    blocks.push({
      key: `by-${source.from}`,
      title:
        recommend.by.length > 1 ? `${title} · ${source.option.label}` : title,
      names,
    })
  }
  if (catalog.length <= OTHERS_MAX)
    blocks.push({
      key: 'others',
      title: 'Outras',
      names: catalog.filter(n => !seen.has(n)),
    })
  return blocks
}

function AddItemSheet({
  visible,
  list,
  identity,
  onClose,
  onAdd,
}: {
  readonly visible: boolean
  readonly list: ResolvedList
  readonly identity: IdentityAdvice
  readonly onClose: () => void
  readonly onAdd: (name: string) => Write
}) {
  // A prévia do item novo (T-08; nota do P07-C), só na Criação com a conta
  const preview = useSheetSelector(s =>
    s.mode === 'create' && s.check
      ? addAdvice(s.model, s.check, s.creationPhase, list.id)
      : null
  )
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
  // Na ordem do rótulo, não na do array do template (T-60); a busca
  // preserva a ordem
  const catalog = useMemo(() => byLabel(def.catalog ?? []), [def.catalog])
  const match = (text: string) => {
    const q = fold(text)
    return {
      options: catalog.filter(name => fold(name).includes(q)),
      exact: catalog.find(name => fold(name) === q),
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
    // Nome livre repetido ("Ambidestro" duas vezes): o servidor aceita, e a
    // folha pede o toque explícito no "Adicionar outro"
    if (have.has(fold(custom)))
      return explain(
        `Já há “${custom}” na ficha. Toque em “Adicionar outro “${custom}”” para repetir.`
      )
    if (!options.length) return pick(custom, 'field')
    explain(
      `Toque numa sugestão, ou em “Adicionar “${custom}”” para usar o nome como está.`
    )
  }
  const noticeAt = (where: string) => (at === where ? notice.text : null)
  const blocks = optionBlocks(catalog, identity, query, options)
  const shown = blocks.reduce((n, b) => n + b.names.length, 0)
  // Sem escolha na identidade, a lista fica neutra e diz o que escolher
  // Uma fonte sem escolha: diga qual falta (as escolhidas já recomendam)
  const choose = identity.missing.length ? chooseText(identity.missing) : null
  // O meta do catálogo de cada nome ("Posto 2"), no texto e no nome acessível
  const metasOf = (name: string): string[] =>
    (def.catalogDefaults ?? []).flatMap(d => {
      if (!d.items.includes(name)) return []
      const m = def.item.meta?.find(x => x.id === d.meta)
      return m ? [`${m.label} ${d.value}`] : []
    })
  const option = (name: string) => {
    const taken = have.has(fold(name))
    const labels = identity.recommended.get(name) ?? []
    const secondary = [...metasOf(name), ...labels]
    const spoken = [name, ...secondary, ...(taken ? ['já na ficha'] : [])]
    return (
      <View key={name}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={spoken.join(', ')}
          disabled={taken}
          onPress={() => pick(name, `option:${name}`)}
          style={styles.option}
        >
          <View style={styles.flex}>
            <Text>{name}</Text>
            {secondary.length ? (
              <Text variant="caption" color="inkMuted">
                {secondary.join(' · ')}
              </Text>
            ) : null}
          </View>
          {taken ? (
            <Text variant="caption" color="inkMuted">
              já na ficha
            </Text>
          ) : null}
        </Pressable>
        {noticeAt(`option:${name}`)}
      </View>
    )
  }
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
        {preview ? (
          <Text variant="caption" color="inkMuted" testID="add-preview">
            {preview}
          </Text>
        ) : null}
        {choose ? (
          <Text variant="caption" color="inkMuted">
            {choose}
          </Text>
        ) : null}
        {blocks.map(block => (
          <View key={block.key} testID={`add-block-${block.key}`}>
            {block.title && block.names.length ? (
              <Text variant="fieldLabel" accessibilityRole="header">
                {block.title}
              </Text>
            ) : null}
            {block.names.map(option)}
          </View>
        ))}
        {!query.trim() && shown < (def.catalog?.length ?? 0) ? (
          <Text variant="caption" color="inkMuted">
            Busque pelo nome para ver o restante da lista.
          </Text>
        ) : null}
        {custom && !exact ? (
          <View style={styles.sheet}>
            {have.has(fold(custom)) ? (
              <Text variant="caption" color="inkMuted" testID="add-repeated">
                {`Já há “${custom}” na ficha.`}
              </Text>
            ) : null}
            <Button
              title={
                have.has(fold(custom))
                  ? `Adicionar outro “${custom}”`
                  : `Adicionar “${custom}”`
              }
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
 * A linha do item com valor, no Editar e na Criação (R-25): o nome abre a
 * folha (nome, metas, especialização e notas) e o −/+ muda o valor ali, sem
 * folha. O toque grava a lista inteira com o `at` do item: a recusa e a
 * previsão do "+" são as da linha de traço (useRowFeedback com o caminho do
 * item), perto do toque. Nada de botão dentro de botão: o nome e o −/+ são
 * alvos lado a lado, cada um com 44 (48 no Android).
 */
function ItemEditorRow({
  list,
  item,
  schema,
  label,
  blocked,
  onOpen,
  onStep,
  below,
}: {
  readonly list: ResolvedList
  readonly item: ListItem
  // O valor do item (só a lista com `item.value` desenha esta linha)
  readonly schema: NonNullable<ListItemSchema['value']>
  // O nome acessível do botão do nome, com o selo
  readonly label: string
  readonly blocked: boolean
  readonly onOpen: () => void
  readonly onStep: (value: number) => void
  // O selo e o aviso da identidade (R-26), embaixo do nome
  readonly below?: ReactNode
}) {
  const { colors } = useTheme()
  const def = list.field.def
  const field = `${list.id}-${item.id}`
  const feedback = useRowFeedback(`values.${list.id}#${item.id}`, field)
  const min = schema.min ?? 0
  const title = itemTitle(list, item) || def.itemLabel
  return (
    <View
      testID={`item-${field}`}
      style={[styles.itemRow, { borderBottomColor: colors.borderSubtle }]}
    >
      <View style={styles.line}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Abre o item: nome, especialização e notas"
          onPress={onOpen}
          style={styles.name}
        >
          <ItemLine list={list} item={item} value={false} />
        </Pressable>
        {/* O "−" com a previsão do P10-C (abaixo do inicial, na criação) */}
        <Stepper
          label={title}
          value={typeof item.value === 'number' ? item.value : min}
          min={min}
          max={schema.max}
          onChange={onStep}
          valueText={n => `${n} de ${schema.max}`}
          disabled={blocked}
          increase={feedback.increase}
          decrease={feedback.decrease}
        />
      </View>
      {below}
      {feedback.note}
      {feedback.notice}
    </View>
  )
}

/**
 * O "+" de um meta que é preço do item (o Custo, o Bônus do Defeito), com a
 * previsão antes do toque, como as linhas (T-08). Com o meta já mudado na
 * folha, a previsão sai: quem decide é o "Aplicar".
 */
function MetaStepper({
  list,
  item,
  meta,
  title,
  value,
  refused,
  onChange,
}: {
  readonly list: ResolvedList
  readonly item: ListItem
  readonly meta: ListMeta
  readonly title: string
  readonly value: number
  readonly refused: boolean
  readonly onChange: (n: number) => void
}) {
  const advice = useSheetSelector(
    s =>
      s.mode === 'create' && s.check
        ? metaAdvice(s.model, s.check, list.id, meta.id)
        : null,
    (a, b) => a?.text === b?.text && a?.blocked === b?.blocked
  )
  const stored = Number(item.meta?.[meta.id] ?? meta.min ?? 0)
  const fresh = value === stored
  const id = `advice-${list.id}-${item.id}-${meta.id}`
  const written = advice && fresh && !refused ? advice.text : null
  return (
    <>
      <View style={styles.inline}>
        <Text style={styles.flex}>{meta.label}</Text>
        <Stepper
          label={`${title}, ${meta.label}`}
          value={value}
          min={meta.min ?? -99}
          max={meta.max ?? 99}
          onChange={onChange}
          increase={
            advice && fresh
              ? {
                  blocked: advice.blocked !== null,
                  hint: advice.text,
                  hintID: refused ? `notice-${list.id}` : written ? id : null,
                }
              : undefined
          }
        />
      </View>
      {written ? (
        <Text variant="caption" color="inkMuted" nativeID={id} testID={id}>
          {written}
        </Text>
      ) : null}
    </>
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
  const fixedHelp = def.fixed?.find(x => x.id === item.id)?.help
  const patch = (p: Partial<Mutable<ListItem>>) => {
    notice.clear()
    setDraft(d => ({ ...d, ...p }))
  }
  const refusal = notice.text
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
            {/* A frase do item fixo (R-19): quem abriu a folha já pediu o item,
                então ela vai como texto, sem "?" */}
            {fixedHelp ? (
              <Text variant="caption" color="inkMuted" testID="item-help">
                {fixedHelp}
              </Text>
            ) : null}
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
            {/* O Valor fica na linha, com o −/+ (R-25) */}
            {(schema.meta ?? []).map(m =>
              m.type === 'number' ? (
                <MetaStepper
                  key={m.id}
                  list={list}
                  item={item}
                  meta={m}
                  title={title}
                  value={Number(draft.meta?.[m.id] ?? m.min ?? 0)}
                  refused={refusal !== null}
                  onChange={n => patch({ meta: { ...draft.meta, [m.id]: n } })}
                />
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
  headerRow: { paddingRight: tokens.layout.gutter },
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
  plain: {
    paddingBottom: tokens.space['0.5'],
    borderBottomWidth: tokens.borderWidth.hair,
  },
  identity: {
    gap: tokens.space['0.5'],
    paddingHorizontal: tokens.layout.gutter,
  },
  itemRow: {
    gap: tokens.space['0.5'],
    paddingVertical: tokens.space[1],
    paddingHorizontal: tokens.layout.gutter,
    borderBottomWidth: tokens.borderWidth.hair,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  name: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: tokens.size.rowMin,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.space[2],
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: tokens.space[3] },
  flex: { flex: 1 },
})
