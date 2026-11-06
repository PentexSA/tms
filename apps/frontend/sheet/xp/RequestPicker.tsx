import {
  costOf,
  type SheetData,
  type SheetModel,
  xpTargetKey,
} from '@tms/sheet-core'
import {
  Button,
  Chip,
  Choice,
  SectionHeader,
  Text,
  TextField,
  tokens,
} from '@tms/ui'
import { useId, useMemo, useState } from 'react'
import { AccessibilityInfo, StyleSheet, View } from 'react-native'
import {
  type CandidateSection,
  filterCandidates,
  freeItemLists,
  groupCandidates,
  optionLabel,
  optionMeta,
  type RequestContext,
  refusalMayBeStale,
  requestRefusal,
  type XpCandidate,
  xpCandidates,
} from './candidates'

// "Solicitar evolução" (T-50): os traços agrupados como a ficha (seções e
// grupos do template), com busca. A escolha é uma só no total: o bloco que
// não tem o traço escolhido fica sem marca. O resumo e "Enviar pedido" ficam
// no rodapé da folha (RequestFooter), fora da rolagem.

export function RequestPicker({
  model,
  sheet,
  chosen,
  onChoose,
  query,
  onQuery,
  context,
}: {
  readonly model: SheetModel
  // A ficha confirmada pelo servidor: o custo é o dela, nunca o do rascunho
  readonly sheet: SheetData
  readonly chosen: XpCandidate | null
  readonly onChoose: (candidate: XpCandidate | null) => void
  readonly query: string
  readonly onQuery: (query: string) => void
  // O saldo e os pedidos pendentes: o que o servidor recusaria fica marcado
  readonly context: Omit<RequestContext, 'online'>
}) {
  const candidates = useMemo(() => xpCandidates(model, sheet), [model, sheet])
  const sections = useMemo(
    () => groupCandidates(model, candidates),
    [model, candidates]
  )
  const shown = useMemo(
    () => filterCandidates(model, sections, query),
    [model, sections, query]
  )
  const lists = useMemo(() => freeItemLists(model), [model])
  const [list, setList] = useState(lists[0]?.id ?? null)
  const [custom, setCustom] = useState('')
  // Item de nome livre: o mesmo core calcula o preço (sem desconto de
  // catálogo para um nome digitado)
  const typed = (listId: string | null, text: string): XpCandidate | null => {
    const def = lists.find(l => l.id === listId)
    const name = text.trim()
    if (!def || !name) return null
    const target = { field: def.id, name }
    return {
      key: xpTargetKey(target),
      target,
      label: `${def.label}: ${name} (novo)`,
      cost: costOf(model, sheet, target),
    }
  }
  const byKey = useMemo(
    () => new Map(candidates.map(c => [c.key, c])),
    [candidates]
  )
  return (
    <View style={styles.form} testID="xp-request-picker">
      <Text color="inkMuted">
        Um nível por pedido. O custo é conferido de novo na aprovação.
      </Text>
      <TextField
        label="Buscar traço"
        value={query}
        maxLength={80}
        testID="xp-request-search"
        onChangeText={onQuery}
      />
      {shown.length ? (
        shown.map(s => (
          <PickerSection
            key={s.id}
            model={model}
            section={s}
            context={context}
            chosen={chosen}
            onChoose={key => {
              setCustom('')
              onChoose(byKey.get(key) ?? null)
            }}
          />
        ))
      ) : (
        <Text color="inkMuted">Nada encontrado para “{query.trim()}”.</Text>
      )}
      {lists.length > 1 ? (
        <View style={styles.chips}>
          {lists.map(l => (
            <Chip
              key={l.id}
              label={l.label}
              selected={list === l.id}
              onPress={() => {
                setList(l.id)
                if (custom.trim()) onChoose(typed(l.id, custom))
              }}
            />
          ))}
        </View>
      ) : null}
      {lists.length ? (
        <TextField
          label={`Novo item em ${lists.find(l => l.id === list)?.label ?? ''} (nome)`}
          value={custom}
          maxLength={80}
          testID="xp-request-custom"
          onChangeText={t => {
            setCustom(t)
            onChoose(typed(list, t))
          }}
        />
      ) : null}
    </View>
  )
}

function PickerSection({
  model,
  section,
  context,
  chosen,
  onChoose,
}: {
  readonly model: SheetModel
  readonly section: CandidateSection
  readonly context: Omit<RequestContext, 'online'>
  readonly chosen: XpCandidate | null
  readonly onChoose: (key: string) => void
}) {
  // Uma seção sem grupos ("Em jogo") tem um bloco com o próprio título: o
  // cabeçalho não se repete
  const [only] = section.blocks
  const header = !(section.blocks.length === 1 && only?.title === section.title)
  return (
    <View style={styles.form}>
      {header ? <SectionHeader title={section.title} level="group" /> : null}
      {section.blocks.map(b => (
        <Choice
          key={b.id}
          label={b.title}
          columns={1}
          testID={`xp-block-${b.id}`}
          // Acima do saldo ou com pedido pendente: tocável, com a cara de
          // bloqueada; o toque a marca, e o rodapé diz o motivo inteiro
          options={b.candidates.map(c => ({
            id: c.key,
            label: optionLabel(model, c),
            ...optionMeta(c, context),
          }))}
          value={
            chosen && b.candidates.some(c => c.key === chosen.key)
              ? chosen.key
              : null
          }
          onChange={onChoose}
        />
      ))}
    </View>
  )
}

/**
 * O rodapé da folha com o pedido escolhido: o resumo, o motivo de o servidor
 * recusar (T-77), o erro dele e "Enviar pedido", sempre à vista. Com motivo,
 * o botão fica bloqueado e tocável: o toque não envia, repete o motivo como
 * alerta e pede o saldo de novo (`onRefresh`), porque o do aparelho pode
 * estar velho.
 */
export function RequestFooter({
  candidate,
  context,
  busy,
  error,
  onSend,
  onRefresh,
}: {
  readonly candidate: XpCandidate | null
  readonly context: RequestContext
  readonly busy: boolean
  readonly error: string | null
  readonly onSend: (cost: number, to: number) => void
  readonly onRefresh: () => void
}) {
  const reasonId = `${useId()}-xp-refusal`
  const cost = candidate?.cost
  const refusal = requestRefusal(candidate, context)
  // O toque no bloqueado vira alerta só para a escolha de agora
  const [alertedFor, setAlertedFor] = useState<string | null | undefined>()
  const alerting =
    alertedFor !== undefined && alertedFor === (candidate?.key ?? null)
  return (
    <View style={styles.footer} testID="xp-request-footer">
      {candidate && cost?.ok ? (
        <Text testID="xp-request-summary">
          {candidate.label}: {cost.from} → {cost.to}. Custo {cost.cost} XP
          (disponível {context.available}).
        </Text>
      ) : null}
      {refusal ? (
        <Text
          nativeID={reasonId}
          testID="xp-request-refusal"
          color={candidate ? 'danger' : 'inkMuted'}
          {...(alerting ? { accessibilityRole: 'alert' as const } : {})}
        >
          {refusal}
        </Text>
      ) : null}
      {error ? (
        <Text color="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button
        title="Enviar pedido"
        testID="xp-request-send"
        busy={busy}
        blocked={refusal !== null}
        hintID={refusal ? reasonId : undefined}
        accessibilityHint={refusal ?? undefined}
        onPress={() => {
          if (refusal) {
            setAlertedFor(candidate?.key ?? null)
            AccessibilityInfo.announceForAccessibility(refusal)
            if (refusalMayBeStale(candidate, context)) onRefresh()
            return
          }
          if (cost?.ok) onSend(cost.cost, cost.to)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: tokens.space[2] },
  // O rodapé da folha é uma linha alinhada à direita: aqui ocupa a largura
  footer: { flex: 1, gap: tokens.space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space[2] },
})
