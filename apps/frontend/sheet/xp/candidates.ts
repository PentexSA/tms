import {
  costOf,
  type ListItem,
  type SheetData,
  type SheetModel,
  type XpCostResult,
  type XpTarget,
  xpTargetKey,
} from '@tms/sheet-core'
import { matches } from '../dice/fold'

// O que o jogador pode pedir, com o custo que o core calcula sobre a ficha
// confirmada (a do servidor, não o rascunho): cada campo de uma regra de XP,
// cada item das listas e os nomes do catálogo que a ficha ainda não tem. Sem
// `costs.xp` ou sem regras, nada (nada de pedido nem saldo inventado).

export interface XpCandidate {
  readonly key: string
  readonly target: XpTarget
  readonly label: string
  readonly cost: XpCostResult
}

const itemsOf = (sheet: SheetData, id: string): ListItem[] => {
  const raw = Object.hasOwn(sheet.values, id) ? sheet.values[id] : undefined
  return Array.isArray(raw) ? (raw as ListItem[]) : []
}

export function xpCandidates(
  model: SheetModel,
  sheet: SheetData
): XpCandidate[] {
  const rules = model.template.costs?.xp?.rules ?? []
  const out: XpCandidate[] = []
  const add = (target: XpTarget, label: string) =>
    out.push({
      key: xpTargetKey(target),
      target,
      label,
      cost: costOf(model, sheet, target),
    })
  for (const rule of rules)
    for (const id of rule.targets) {
      const def = model.fields.get(id)?.def
      if (!def) continue
      if (def.type !== 'list') {
        add({ field: id }, def.label)
        continue
      }
      const items = itemsOf(sheet, id)
      for (const item of items)
        add(
          { field: id, item: item.id },
          `${def.label}: ${item.name ?? def.itemLabel}`
        )
      if (def.fixed) continue
      const taken = new Set(items.map(x => x.name))
      for (const name of def.catalog ?? [])
        if (!taken.has(name))
          add({ field: id, name }, `${def.label}: ${name} (novo)`)
    }
  return out
}

/**
 * O candidato do alvo escolhido, sobre a ficha confirmada de agora: o custo
 * e o "para" são sempre os atuais, nunca os da hora do toque (a ficha pode
 * ter mudado com a folha aberta, e o `expectedCost` velho daria 409). Um item
 * de nome livre, fora da lista, ganha o preço do mesmo core.
 */
export function candidateFor(
  model: SheetModel,
  sheet: SheetData,
  candidates: readonly XpCandidate[],
  target: XpTarget | null
): XpCandidate | null {
  if (!target) return null
  const key = xpTargetKey(target)
  const listed = candidates.find(c => c.key === key)
  if (listed) return listed
  const def = model.fields.get(target.field)?.def
  if (!target.name || def?.type !== 'list') return null
  return {
    key,
    target,
    label: `${def.label}: ${target.name} (novo)`,
    cost: costOf(model, sheet, target),
  }
}

/** Listas com regra de XP que aceitam um item novo de nome livre. */
export function freeItemLists(model: SheetModel) {
  const rules = model.template.costs?.xp?.rules ?? []
  return rules
    .flatMap(r => r.targets)
    .map(id => model.fields.get(id))
    .filter(f => f?.def.type === 'list' && !f.def.fixed)
    .map(f => ({ id: f?.id as string, label: f?.def.label ?? '' }))
}

/** "Destreza 2 → 3 · 8 XP", ou o motivo de não dar para pedir. */
export function costLabel(c: XpCandidate): string {
  if (c.cost.ok) return `${c.cost.from} → ${c.cost.to} · ${c.cost.cost} XP`
  switch (c.cost.code) {
    case 'XP_MAX_REACHED':
      return 'No máximo'
    case 'XP_PREREQUISITE':
      return 'Falta um pré-requisito'
    default:
      return 'Sem evolução por XP'
  }
}

export interface RequestContext {
  readonly available: number
  // `xpTargetKey` dos pedidos pendentes desta ficha
  readonly pendingKeys: ReadonlySet<string>
  readonly online: boolean
}

/**
 * Por que o servidor recusaria este pedido agora (T-77), na ordem em que ele
 * confere (`xp/requests.ts`): sem custo (máximo, pré-requisito), sem saldo,
 * pedido pendente do mesmo traço. Sem rede, nada sai. Null quando dá para
 * enviar. A previsão só erra para o lado bloqueado (o saldo do aparelho pode
 * estar velho), e o servidor continua a última palavra.
 */
export function requestRefusal(
  c: XpCandidate | null,
  { available, pendingKeys, online }: RequestContext
): string | null {
  if (!c) return 'Escolha um traço para ver o custo.'
  if (!c.cost.ok)
    return `${costLabel(c)}: este traço não pode ser pedido agora.`
  if (available < c.cost.cost)
    return `Faltam ${c.cost.cost - available} XP (custa ${c.cost.cost}, disponível ${available}).`
  if (pendingKeys.has(c.key)) return 'Já há um pedido pendente para este traço.'
  if (!online) return 'Conecte-se para enviar. Nada foi enviado.'
  return null
}

/**
 * O texto curto da opção na lista: o custo e, se o servidor recusaria, o
 * motivo em poucas palavras ("2 → 3 · 10 XP · faltam 4").
 */
export function optionMeta(
  c: XpCandidate,
  { available, pendingKeys }: Omit<RequestContext, 'online'>
): { readonly meta: string; readonly blocked: boolean } {
  const base = costLabel(c)
  if (!c.cost.ok) return { meta: base, blocked: true }
  if (available < c.cost.cost)
    return {
      meta: `${base} · faltam ${c.cost.cost - available}`,
      blocked: true,
    }
  if (pendingKeys.has(c.key))
    return { meta: `${base} · pedido pendente`, blocked: true }
  return { meta: base, blocked: false }
}

/** Um bloco da lista de evolução: um grupo do template, uma seção ou uma lista. */
export interface CandidateBlock {
  readonly id: string
  readonly title: string
  readonly candidates: readonly XpCandidate[]
}

/** Uma seção do template com os seus blocos, na ordem da ficha. */
export interface CandidateSection {
  readonly id: string
  readonly title: string
  readonly blocks: readonly CandidateBlock[]
}

const isList = (model: SheetModel, id: string) =>
  model.fields.get(id)?.def.type === 'list'

/**
 * O nome da opção dentro do bloco: o do traço ("Briga") ou, numa lista, o do
 * item ("Taumaturgia (novo)"), sem repetir o nome da lista, que é o título
 * do bloco.
 */
export function optionLabel(model: SheetModel, c: XpCandidate): string {
  const def = model.fields.get(c.target.field)?.def
  if (!def || def.type !== 'list') return c.label
  const prefix = `${def.label}: `
  return c.label.startsWith(prefix) ? c.label.slice(prefix.length) : c.label
}

/**
 * Os candidatos agrupados como a ficha (T-50): as seções na ordem das abas e
 * do template, os grupos de cada seção e, dentro deles, os traços na ordem
 * do template. Uma lista (Disciplinas, Antecedentes) é um bloco próprio, com
 * os itens que a ficha tem primeiro e os nomes do catálogo depois. Tudo vem
 * do template: nada aqui cita sistema.
 */
export function groupCandidates(
  model: SheetModel,
  candidates: readonly XpCandidate[]
): CandidateSection[] {
  const byField = new Map<string, XpCandidate[]>()
  for (const c of candidates) {
    const list = byField.get(c.target.field) ?? []
    list.push(c)
    byField.set(c.target.field, list)
  }
  const placed = new Set<string>()
  const out: CandidateSection[] = []
  const sections = model.zones.flatMap(z => z.sections)
  for (const section of sections) {
    const title = section.def.title
    const groups = section.groups ?? [
      { id: section.id, title, fieldIds: section.fieldIds },
    ]
    const blocks: CandidateBlock[] = []
    for (const group of groups) {
      // Os traços seguidos formam um bloco com o título do grupo; cada lista
      // abre um bloco seu, no lugar dela
      let run: XpCandidate[] = []
      const flush = () => {
        if (!run.length) return
        blocks.push({
          id: `${section.id}/${group.id}/${blocks.length}`,
          title: group.title,
          candidates: run,
        })
        run = []
      }
      for (const id of group.fieldIds) {
        const field = model.fields.get(id)
        const mine = byField.get(id)
        if (!field || !mine || field.sectionIds[0] !== section.id) continue
        placed.add(id)
        if (!isList(model, id)) {
          run.push(...mine)
          continue
        }
        flush()
        blocks.push({
          id: `${section.id}/${id}`,
          title: field.def.label,
          // Os itens da ficha antes dos nomes novos do catálogo
          candidates: [
            ...mine.filter(c => c.target.item),
            ...mine.filter(c => !c.target.item),
          ],
        })
      }
      flush()
    }
    if (blocks.length) out.push({ id: section.id, title, blocks })
  }
  // Um alvo fora das seções (não deveria acontecer) não some
  const rest = candidates.filter(c => !placed.has(c.target.field))
  if (rest.length)
    out.push({
      id: 'other',
      title: 'Outros',
      blocks: [{ id: 'other', title: 'Outros', candidates: rest }],
    })
  return out
}

/**
 * A lista filtrada pela busca, sem acento nem caixa: pelo nome da opção e
 * pelo título do bloco ("Disciplinas" mostra a lista inteira). Bloco e seção
 * vazios somem.
 */
export function filterCandidates(
  model: SheetModel,
  sections: readonly CandidateSection[],
  query: string
): CandidateSection[] {
  if (!query.trim()) return [...sections]
  return sections
    .map(s => ({
      ...s,
      blocks: s.blocks
        .map(b =>
          matches(b.title, query)
            ? b
            : {
                ...b,
                candidates: b.candidates.filter(c =>
                  matches(optionLabel(model, c), query)
                ),
              }
        )
        .filter(b => b.candidates.length),
    }))
    .filter(s => s.blocks.length)
}
