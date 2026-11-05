import type { Issue } from './issues'

// Regras que valem só na publicação de um template (R-19, P10-D): a ajuda é
// texto de uma linha e sem link. Os nós são exatamente os que usam
// `$defs/helpText` e `$defs/helpShort` no schema.json, e o validate.mjs
// (`publicationIssues`) confere os mesmos, com as mesmas mensagens.
//
// Fica fora do validateTemplate de propósito: o compileTemplate do app roda o
// validateTemplate em toda versão já publicada, e uma regra nova ali poderia
// derrubar uma ficha antiga ("Atualize o app"). Na leitura, tolerante; na
// escrita (publicação), estrito.

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const objs = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])
const values = (v: unknown): [string, Obj][] =>
  isObj(v)
    ? Object.entries(v).filter((e): e is [string, Obj] => isObj(e[1]))
    : []

const entries = (v: unknown): [string, unknown][] =>
  isObj(v) ? Object.entries(v) : []

const LINK = /:\/\/|www\./i
const LINE_BREAK = /[\t\n\r]/

/** A ajuda do template na publicação: uma linha e sem link. */
export function publicationIssues(t: unknown): Issue[] {
  const issues: Issue[] = []
  const check = (path: string, v: unknown) => {
    if (typeof v !== 'string') return
    if (LINE_BREAK.test(v))
      issues.push({ path, message: 'ajuda em uma linha só' })
    if (LINK.test(v))
      issues.push({
        path,
        message: 'ajuda com link (://, www.): a frase é texto puro',
      })
  }
  if (!isObj(t)) return issues
  for (const [id, f] of values(t.fields)) {
    const p = `fields.${id}`
    check(`${p}.help`, f.help)
    for (const o of objs(f.options)) {
      if (f.type === 'state') check(`${p}.options.${o.id}.note`, o.note)
      if (f.type === 'state' || f.type === 'choice')
        check(`${p}.options.${o.id}.help`, o.help)
    }
    if (f.type === 'list') {
      for (const x of objs(f.fixed)) check(`${p}.fixed.${x.id}.help`, x.help)
      for (const [name, v] of entries(f.catalogHelp))
        check(`${p}.catalogHelp.${name}`, v)
    }
    if (f.type === 'text')
      for (const [name, v] of entries(f.suggestionHelp))
        check(`${p}.suggestionHelp.${name}`, v)
    if (f.type === 'resource')
      for (const a of objs(f.actions))
        check(`${p}.actions.${a.id}.help`, a.help)
  }
  for (const s of objs(t.sections))
    for (const g of objs(s.groups))
      check(`sections.${s.id}.groups.${g.id}.help`, g.help)
  const roll = isObj(t.roll) ? t.roll : {}
  for (const pr of objs(roll.presets))
    check(`roll.presets.${pr.id}.help`, pr.help)
  for (const a of objs(t.actions)) check(`actions.${a.id}.help`, a.help)
  for (const o of objs(t.options)) check(`options.${o.id}.help`, o.help)
  for (const r of objs(t.recoveries)) check(`recoveries.${r.id}.help`, r.help)
  return issues
}
