import {
  type CreationCheck,
  type CreationProblem,
  canReadSection,
  type FieldId,
  fieldRank,
  type ResolvedSheet,
  type RoleName,
  type SheetModel,
} from '@tms/sheet-core'
import { problemText } from './creation'

// O guia da criação (D-05, R-18): o "O que falta" como itens que levam ao
// grupo, para a barra ("Faltam: Virtudes 7 · e mais 2") e para a aba Pontos.
// Os itens saem dos `problems` do `checkCreation`, a mesma conta que o
// servidor repete a cada lote e ao concluir: aqui só se decide o texto curto,
// a ordem e o alvo na tela. Nada aqui conhece sistema: grupos, orçamentos e
// rótulos vêm do template, e nenhum texto da ficha entra no item.

/**
 * `blocking` impede salvar; `missing` impede concluir; `confirm` não impede
 * nada ("confirme com o narrador", preenchido pelo P07-D): nunca conta no
 * "Faltam" da barra nem esconde ou libera o "Concluir".
 */
export type GuideKind = 'blocking' | 'missing' | 'confirm'

export interface GuideTarget {
  // A aba: uma zona com aba ('build' | 'powers' | 'lore'), 'play' (o "Em
  // jogo", que abre se estiver recolhido) ou 'creation' (a aba Pontos)
  readonly tab: string
  // O id da seção (CompiledSection.id) e o do grupo dela, se ela tem grupos
  readonly section: string | null
  readonly group: string | null
  // `values.<campo>` ou `values.<lista>#<item>`
  readonly path: string | null
}

export interface GuideItem {
  // Estável entre renders: `${code}:${budget}:${group}:${path}`
  readonly key: string
  readonly kind: GuideKind
  // O texto visível na barra: "Virtudes 7"
  readonly short: string
  // A frase inteira: "Virtudes: faltam 7 pontos básicos."
  readonly text: string
  // null (seção que o papel não lê): leva à lista, na aba Pontos
  readonly target: GuideTarget | null
}

/** A aba de pontos da criação (o id de sempre: `creation`). */
export const POINTS_TAB = 'creation'

/** A lista inteira, na aba Pontos ("e mais N", "Faltam N itens"). */
export const MISSING_TARGET: GuideTarget = {
  tab: POINTS_TAB,
  section: 'creation-missing',
  group: null,
  path: null,
}

/** "Onde foram os bônus", na aba Pontos (o bônus acima do saldo). */
export const LEDGER_TARGET: GuideTarget = {
  tab: POINTS_TAB,
  section: 'creation-ledger',
  group: null,
  path: null,
}

const KIND_ORDER: Readonly<Record<GuideKind, number>> = {
  blocking: 0,
  missing: 1,
  confirm: 2,
}

const fieldOfPath = (path: string): FieldId =>
  path.replace(/^values\./, '').split('#')[0] ?? ''

/** A primeira seção que o papel lê com o campo, e o grupo dela que o tem. */
function targetOf(
  model: SheetModel,
  roles: ReadonlySet<RoleName>,
  field: FieldId | undefined,
  path: string | null
): GuideTarget | null {
  if (!field) return null
  const sectionId = model.fields.get(field)?.sectionIds[0]
  const section = sectionId ? model.sections.get(sectionId) : undefined
  if (!section || !canReadSection(model, section.id, [...roles])) return null
  const group = section.groups?.find(g => g.fieldIds.includes(field))
  return {
    tab: section.zone,
    section: section.id,
    group: group?.id ?? null,
    path,
  }
}

/** Os alvos do grupo (ou do orçamento inteiro) no template. */
function targetsOf(
  model: SheetModel,
  budgetId: string | undefined,
  groupId: string | undefined
): readonly FieldId[] {
  const b = model.template.creation?.budgets.find(x => x.id === budgetId)
  if (!b) return []
  if (b.rule !== 'priority-budget') return b.targets
  const g = b.groups.find(x => x.id === groupId) ?? b.groups[0]
  return g?.targets ?? []
}

const groupLabel = (check: CreationCheck, p: CreationProblem): string =>
  check.budgets.find(b => b.id === p.budget)?.groups.find(g => g.id === p.group)
    ?.label ?? 'Um grupo'

const budgetLabel = (check: CreationCheck, p: CreationProblem): string =>
  check.budgets.find(b => b.id === p.budget)?.label ?? 'Um grupo'

const fieldLabel = (model: SheetModel, field: FieldId): string =>
  model.fields.get(field)?.def.label ?? 'Um campo'

/**
 * Os itens do "O que falta", na ordem: primeiro os que impedem salvar,
 * depois os que impedem concluir; dentro de cada tipo, a ordem da ficha.
 * Sem conta (`check` nulo) ou com ela fechada, nenhum item.
 */
export function guideItems(
  model: SheetModel,
  check: CreationCheck | null,
  roles: ReadonlySet<RoleName>,
  // A ficha resolvida, para o texto dizer de onde vem o inicial (P10-C, T-85)
  resolved?: ResolvedSheet
): readonly GuideItem[] {
  if (!check || check.complete) return []
  const ranked: { readonly item: GuideItem; readonly rank: number }[] = []
  const priorities = new Map<string, number>()
  const rankOf = (fields: readonly FieldId[]) =>
    fields.reduce(
      (min, f) => Math.min(min, fieldRank(model, f)),
      Number.MAX_SAFE_INTEGER
    )
  for (const p of check.problems) {
    const kind: GuideKind = p.severity === 'blocking' ? 'blocking' : 'missing'
    const n = p.amount ?? 0
    if (p.code === 'CREATION_PRIORITIES_REQUIRED') {
      // Um item por orçamento: escolher a prioridade de um grupo ordena os
      // outros (R-28), e seis itens diriam a mesma coisa
      const label = budgetLabel(check, p)
      const at = priorities.get(p.budget ?? '')
      if (at !== undefined) {
        const was = ranked[at]
        if (was && kind === 'blocking' && was.item.kind !== 'blocking')
          ranked[at] = { ...was, item: { ...was.item, kind } }
        continue
      }
      const fields = targetsOf(model, p.budget, p.group)
      priorities.set(p.budget ?? '', ranked.length)
      ranked.push({
        rank: rankOf(fields),
        item: {
          key: `${p.code}:${p.budget ?? ''}::`,
          kind,
          short: `${label} (prioridade)`,
          text: `${label}: escolha a prioridade.`,
          target: targetOf(model, roles, fields[0], null),
        },
      })
      continue
    }
    const key = `${p.code}:${p.budget ?? ''}:${p.group ?? ''}:${p.paths.join(',')}`
    const text = problemText(model, check, p, resolved)
    if (p.code === 'CREATION_FREEBIES_EXCEEDED') {
      // Não é de um grupo: leva à aba Pontos, ao "Onde foram os bônus"
      ranked.push({
        rank: Number.MAX_SAFE_INTEGER,
        item: {
          key,
          kind,
          short: n ? `Bônus: ${n} acima` : 'Bônus acima',
          text,
          target: LEDGER_TARGET,
        },
      })
      continue
    }
    if (
      p.code === 'CREATION_BASICS_UNSPENT' ||
      p.code === 'CREATION_POINTBUY_UNSPENT' ||
      p.code === 'CREATION_POINTBUY_EXCEEDED'
    ) {
      const fields = targetsOf(model, p.budget, p.group)
      const label = groupLabel(check, p)
      ranked.push({
        rank: rankOf(fields),
        item: {
          key,
          kind,
          short:
            p.code === 'CREATION_POINTBUY_EXCEEDED'
              ? `${label}: ${n} acima`
              : `${label} ${n}`,
          text,
          target: targetOf(model, roles, fields[0], null),
        },
      })
      continue
    }
    // O problema de um campo: o primeiro caminho, com o `#item` quando houver
    const path = p.paths[0] ?? null
    const field = path ? fieldOfPath(path) : undefined
    ranked.push({
      rank: field ? fieldRank(model, field) : Number.MAX_SAFE_INTEGER,
      item: {
        key,
        kind,
        short: field ? fieldLabel(model, field) : 'Um campo',
        text,
        target: targetOf(model, roles, field, path),
      },
    })
  }
  return ranked
    .map((r, i) => ({ ...r, i }))
    .sort(
      (a, b) =>
        KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind] ||
        a.rank - b.rank ||
        a.i - b.i
    )
    .map(r => r.item)
}

// A conta de largura do "Faltam" (§3.3): `caption` de 13 × `fontScale`, a
// 0,6 em por caractere, com folga sobre os ~0,52 medidos (P04-D). Errar
// para menos mostra um item a menos; nunca corta um texto.
const CAPTION = 13
const EM_PER_CHAR = 0.6
const SEP = ' · '

/** "Faltam:" com dois ou mais itens, "Falta:" com um. */
export const guidePrefix = (total: number): string =>
  total === 1 ? 'Falta:' : 'Faltam:'

/** "e mais 2". */
export const moreText = (n: number): string => `e mais ${n}`

/** O botão único, quando nem um item cabe: "Faltam 5 itens". */
export const allText = (n: number): string =>
  n === 1 ? 'Falta 1 item' : `Faltam ${n} itens`

/**
 * Quantos itens inteiros cabem no slot da barra. `shown` vazio com `more`
 * maior que zero: a linha vira um botão só ("Faltam N itens"). Os `confirm`
 * já devem ter saído da lista.
 */
export function fitGuide(
  items: readonly GuideItem[],
  width: number,
  fontScale: number
): { readonly shown: readonly GuideItem[]; readonly more: number } {
  if (!items.length) return { shown: [], more: 0 }
  const capacity =
    width / (CAPTION * (fontScale > 0 ? fontScale : 1) * EM_PER_CHAR)
  const prefix = `${guidePrefix(items.length)} `
  let used = prefix.length
  const shown: GuideItem[] = []
  for (const [i, item] of items.entries()) {
    const left = items.length - i - 1
    const next = used + (shown.length ? SEP.length : 0) + item.short.length
    const tail = left ? SEP.length + moreText(left).length : 0
    if (next + tail > capacity) break
    shown.push(item)
    used = next
  }
  return { shown, more: items.length - shown.length }
}

const NONE: readonly GuideItem[] = Object.freeze([])

/**
 * Os avisos que não bloqueiam (kind `confirm`): "confirme com o narrador"
 * (D-07, D-09). O P07-D implementa; até lá, nenhum. Eles aparecem na aba
 * Pontos ("Para confirmar com o narrador") e na confirmação de concluir,
 * nunca no "Faltam" da barra.
 */
export function useCreationNotices(): readonly GuideItem[] {
  return NONE
}

/** "1 item para confirmar com o narrador; veja em Pontos." */
export function confirmNote(n: number): string | null {
  if (n <= 0) return null
  return n === 1
    ? '1 item para confirmar com o narrador; veja em Pontos.'
    : `${n} itens para confirmar com o narrador; veja em Pontos.`
}
