import type { CreationCheck, CreationProblem } from '@tms/sheet-core'
import { freebiesBalance } from './creation'
import { captionChars, moreText } from './guide'

// O progresso da criação no cartão da Mesa (P09-D, D-10, R-15): "Atributos ✓
// · Habilidades: faltam 4 · Bônus: restam 2 de 15", ou "A conta fechou". Lê o
// mesmo `CreationCheck` do guia e da barra do jogador (a conta do core, que o
// servidor repete a cada lote, ao concluir e ao aprovar) e usa as mesmas
// peças: o "(prioridade)" e o "acima" do `guideItems`, a concordância do
// `problemText` e o bônus do `freebiesBalance`. O que é só do cartão: a soma
// por orçamento, o "✓" e o "traço para corrigir". Nada aqui conhece sistema:
// orçamentos e rótulos vêm do template, e nenhum texto da ficha entra.

export type ProgressKind =
  | 'done'
  | 'missing'
  | 'blocking'
  | 'freebies'
  | 'closed'

export interface ProgressPart {
  // O id do orçamento, ou 'fields', 'freebies', 'closed', 'done', 'more'
  readonly key: string
  readonly kind: ProgressKind
  // O que aparece: "Atributos ✓", "Habilidades: faltam 4"
  readonly text: string
  // O que o leitor de tela lê: "Atributos completos"
  readonly spoken: string
}

export interface CreationProgress {
  // A conta fechou (`check.complete`)
  readonly closed: boolean
  readonly parts: readonly ProgressPart[]
}

const SEP = ' · '
// Folga para a quebra entre palavras, sobre a conta de largura do guia
const WRAP_SLACK = 0.9

// Os problemas que são de um orçamento; o bônus e os de campo ficam à parte
const BUDGET_CODES: ReadonlySet<CreationProblem['code']> = new Set([
  'CREATION_PRIORITIES_REQUIRED',
  'CREATION_BASICS_UNSPENT',
  'CREATION_POINTBUY_EXCEEDED',
  'CREATION_POINTBUY_UNSPENT',
])

const faltam = (n: number): string => (n === 1 ? 'falta 1' : `faltam ${n}`)

const fieldsText = (n: number): string =>
  n === 1 ? '1 traço para corrigir' : `${n} traços para corrigir`

const sum = (problems: readonly CreationProblem[]): number =>
  problems.reduce((n, p) => n + (p.amount ?? 0), 0)

/**
 * As partes do progresso, na ordem do template (os orçamentos), depois os
 * traços para corrigir e, no fim, o bônus. Sem conta (criação livre, sem
 * `creation` no template, `check` nulo): null, e o cartão fica sem a linha.
 */
export function creationProgress(
  check: CreationCheck | null
): CreationProgress | null {
  if (!check || check.mode !== 'points') return null
  const balance = freebiesBalance(check)
  const left = check.freebies?.remaining ?? 0
  if (check.complete) {
    const parts: ProgressPart[] = [
      {
        key: 'closed',
        kind: 'closed',
        text: 'A conta fechou',
        spoken: 'A conta fechou',
      },
    ]
    // O bônus só se sobrou
    if (balance && left > 0)
      parts.push({
        key: 'freebies',
        kind: 'freebies',
        text: balance,
        spoken: balance,
      })
    return { closed: true, parts }
  }
  const parts: ProgressPart[] = []
  for (const b of check.budgets) {
    const own = check.problems.filter(
      p => p.budget === b.id && BUDGET_CODES.has(p.code)
    )
    const priority = own.filter(p => p.code === 'CREATION_PRIORITIES_REQUIRED')
    const over = own.filter(p => p.code === 'CREATION_POINTBUY_EXCEEDED')
    const unspent = sum(
      own.filter(
        p =>
          p.code === 'CREATION_BASICS_UNSPENT' ||
          p.code === 'CREATION_POINTBUY_UNSPENT'
      )
    )
    if (priority.length) {
      parts.push({
        key: b.id,
        kind: priority.some(p => p.severity === 'blocking')
          ? 'blocking'
          : 'missing',
        text: `${b.label} (prioridade)`,
        spoken: `${b.label}: falta escolher a prioridade`,
      })
    } else if (over.length) {
      const text = `${b.label}: ${sum(over)} acima`
      parts.push({ key: b.id, kind: 'blocking', text, spoken: text })
    } else if (unspent > 0) {
      const text = `${b.label}: ${faltam(unspent)}`
      parts.push({ key: b.id, kind: 'missing', text, spoken: text })
    } else {
      parts.push({
        key: b.id,
        kind: 'done',
        text: `${b.label} ✓`,
        spoken: `${b.label} completos`,
      })
    }
  }
  const fields = check.problems.filter(
    p => !BUDGET_CODES.has(p.code) && p.code !== 'CREATION_FREEBIES_EXCEEDED'
  )
  if (fields.length) {
    // Um traço por caminho: dois problemas no mesmo campo são um traço só
    const text = fieldsText(
      new Set(fields.map((p, i) => p.paths[0] ?? `${p.code}:${i}`)).size
    )
    parts.push({
      key: 'fields',
      kind: fields.some(p => p.severity === 'blocking')
        ? 'blocking'
        : 'missing',
      text,
      spoken: text,
    })
  }
  if (balance)
    parts.push({
      key: 'freebies',
      kind: left < 0 ? 'blocking' : 'freebies',
      text: balance,
      spoken: balance,
    })
  return { closed: false, parts }
}

/** Tudo, para o nome acessível do cartão. */
export const progressSpoken = (p: CreationProgress): string =>
  p.parts.map(part => part.spoken).join(', ')

const joined = (parts: readonly ProgressPart[]): string =>
  parts.map(p => p.text).join(SEP)

const moreOf = (n: number): ProgressPart => ({
  key: 'more',
  kind: 'missing',
  text: moreText(n),
  spoken: moreText(n),
})

/**
 * As partes que cabem em `lines` linhas (2 no cartão), sem cortar texto (a
 * regra do guia: nunca reticências). Quando não cabe, nesta ordem: os
 * orçamentos completos viram um só, no começo ("✓ 3 de 5"); depois, o que
 * sobra vira "e mais N", com o bônus sempre no fim. A largura é a da janela
 * e da coluna, não a do `onLayout` (no RN-web, ele só dispara quando o
 * tamanho muda: A3 da onda 4).
 */
export function fitProgress(
  progress: CreationProgress,
  width: number,
  fontScale: number,
  lines = 2
): { readonly shown: readonly ProgressPart[]; readonly text: string } {
  const capacity = captionChars(width, fontScale) * lines * WRAP_SLACK
  const fits = (parts: readonly ProgressPart[]) =>
    joined(parts).length <= capacity
  const all = progress.parts
  if (fits(all)) return { shown: all, text: joined(all) }
  // O bônus é pela chave, não pelo tipo: acima do saldo ele é `blocking`, e
  // continua no fim, fora da conta dos orçamentos e do "e mais N"
  const tail = all.filter(p => p.key === 'freebies')
  const budgets = all.filter(p => p.key !== 'freebies' && p.key !== 'fields')
  const done = all.filter(p => p.kind === 'done')
  const rest = all.filter(
    p => (p.kind === 'missing' || p.kind === 'blocking') && p.key !== 'freebies'
  )
  // "A conta fechou" nunca sai: sem ela, o cartão pronto se leria como um
  // ainda em criação
  const closed = all.filter(p => p.kind === 'closed')
  const head: ProgressPart[] = [
    ...closed,
    ...(done.length
      ? [
          {
            key: 'done',
            kind: 'done' as const,
            text: `✓ ${done.length} de ${budgets.length}`,
            spoken: `${done.length} de ${budgets.length} orçamentos completos`,
          },
        ]
      : []),
  ]
  const merged = [...head, ...rest, ...tail]
  if (fits(merged)) return { shown: merged, text: joined(merged) }
  // "e mais N": os primeiros que cabem, e o bônus no fim
  const kept: ProgressPart[] = []
  for (const [i, part] of rest.entries()) {
    const more = rest.length - i - 1
    const candidate = [
      ...head,
      ...kept,
      part,
      ...(more ? [moreOf(more)] : []),
      ...tail,
    ]
    if (!fits(candidate)) break
    kept.push(part)
  }
  const hidden = rest.length - kept.length
  const shown = [...head, ...kept, ...(hidden ? [moreOf(hidden)] : []), ...tail]
  return { shown, text: joined(shown) }
}
