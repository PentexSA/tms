// Dados de teste: os templates, as fichas de exemplo e a paleta do design, mais
// o validador de referência (design/scripts/validate.mjs). Tudo é lido do repo,
// então o teste acompanha o contrato sem cópia.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatIssue, type Issue } from '../validate'

export type Json = Record<string, unknown>

const DESIGN = join(import.meta.dir, '../../../../design')

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(join(DESIGN, path), 'utf8'))

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

interface Tokens {
  color: { accents: { palette: { name: string }[] } }
}
export const palette = (
  readJson('design-system/tokens.json') as Tokens
).color.accents.palette.map(a => a.name)

export const templates: Record<string, Json> = {}
for (const file of readdirSync(join(DESIGN, 'templates'))) {
  if (!file.endsWith('.json') || file === 'schema.json') continue
  const t = readJson(`templates/${file}`) as Json
  templates[t.system as string] = t
}

export interface Example {
  id: string
  system: string
  sheet: Json & { values: Json }
}
export const characters = (
  readJson('templates/exemplos/personagens.json') as { characters: Example[] }
).characters

export const schema = readJson('templates/schema.json') as {
  $defs: Record<string, { enum?: unknown[]; not?: { enum?: unknown[] } }>
}

interface Reference {
  REGISTRY: Record<string, unknown[]>
  validateTemplate(t: unknown, palette: string[]): string[]
  validateSheet(t: unknown, sheet: unknown, who?: string): string[]
}
const referencePath = join(DESIGN, 'scripts/validate.mjs')
export const reference = (await import(referencePath)) as Reference

export function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`fixture ausente: ${what}`)
  return v
}

// Template v0 (produto) e fixture de outra família (só teste).
export const vtm = () => clone(must(templates['vtm-v20'], 'vtm-v20'))
export const dnd = () => clone(must(templates['dnd5e-2014'], 'dnd5e-2014'))
export const character = (id: string) =>
  clone(
    must(
      characters.find(c => c.id === id),
      id
    )
  )

export const fmt = (prefix: string, issues: Issue[]) =>
  issues.map(i => formatIssue(prefix, i))

export const paths = (issues: Issue[]) => issues.map(i => i.path)
