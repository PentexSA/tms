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
import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  type CandidateSection,
  costLabel,
  filterCandidates,
  freeItemLists,
  groupCandidates,
  optionLabel,
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
}: {
  readonly model: SheetModel
  // A ficha confirmada pelo servidor: o custo é o dela, nunca o do rascunho
  readonly sheet: SheetData
  readonly chosen: XpCandidate | null
  readonly onChoose: (candidate: XpCandidate | null) => void
  readonly query: string
  readonly onQuery: (query: string) => void
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
  chosen,
  onChoose,
}: {
  readonly model: SheetModel
  readonly section: CandidateSection
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
          options={b.candidates.map(c => ({
            id: c.key,
            label: optionLabel(model, c),
            meta: costLabel(c),
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
 * O rodapé da folha com o pedido escolhido: o resumo, o erro do servidor e
 * "Enviar pedido", sempre à vista, sem rolar a lista.
 */
export function RequestFooter({
  candidate,
  available,
  online,
  busy,
  error,
  onSend,
}: {
  readonly candidate: XpCandidate | null
  readonly available: number
  readonly online: boolean
  readonly busy: boolean
  readonly error: string | null
  readonly onSend: (cost: number, to: number) => void
}) {
  const cost = candidate?.cost
  return (
    <View style={styles.footer} testID="xp-request-footer">
      {!candidate ? (
        <Text color="inkMuted">Escolha um traço para ver o custo.</Text>
      ) : cost?.ok ? (
        <Text testID="xp-request-summary">
          {candidate.label}: {cost.from} → {cost.to}. Custo {cost.cost} XP
          (disponível {available}).
        </Text>
      ) : (
        <Text color="danger" accessibilityRole="alert">
          {costLabel(candidate)}: este traço não pode ser pedido agora.
        </Text>
      )}
      {candidate && cost?.ok && available < cost.cost ? (
        <Text color="inkMuted">
          Saldo insuficiente para esta evolução: o servidor vai recusar.
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
        disabled={!online || !cost?.ok}
        onPress={() => {
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
