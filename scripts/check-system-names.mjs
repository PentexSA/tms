// O código conhece tipos; o template conhece o sistema (doc/arquitetura §1).
// Falha se o código do app, do @tms/ui ou da API citar um sistema pelo nome:
// o código de um sistema (de design/templates/*.json) ou um nome da lista
// fechada que leva o sistema no nome (vtmBloodPool, mage-quint-paradox), ou
// o id de uma opção de `state` entre aspas ('crinos'): a view da forma não
// pode saber qual forma é qual.
// Esses nomes só podem aparecer no @tms/sheet-core, nos templates e nos
// testes (plano-v1 §4). Comentários não contam.
//
// Uso: node scripts/check-system-names.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const DIRS = [
  'apps/frontend/app',
  'apps/frontend/sheet',
  'apps/frontend/lib',
  'apps/frontend/components',
  'apps/api/src',
  'packages/ui/src',
]
// A lista dos templates do produto é o único lugar com o código do sistema
const ALLOWED = new Set(['apps/api/src/templates/published.ts'])

const templates = readdirSync(join(ROOT, 'design/templates'))
  .filter(f => f.endsWith('.json') && f !== 'schema.json')
  .map(f => JSON.parse(readFileSync(join(ROOT, 'design/templates', f), 'utf8')))
const systems = templates.map(t => t.system)
const stateOptions = templates.flatMap(t =>
  Object.values(t.fields ?? {})
    .filter(f => f.type === 'state')
    .flatMap(f => (f.options ?? []).map(o => o.id))
)
const literal = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const FORBIDDEN = new RegExp(
  `['"\`](?:${[...systems, ...stateOptions].map(literal).join('|')})['"\`]|\\b(?:vtm|mta|wta|dnd5e|coc|fate)[A-Z]\\w*|\\bmage-[a-z-]+`
)

// Tira comentários de linha e de bloco, sem mexer em strings
const stripComments = src =>
  src.replace(
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    (m, str) => str ?? ''
  )

const hits = []
const walk = dir => {
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'test' || name === 'node_modules')
        continue
      walk(p)
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      const rel = relative(ROOT, p)
      if (ALLOWED.has(rel)) continue
      stripComments(readFileSync(p, 'utf8'))
        .split('\n')
        .forEach((line, i) => {
          const m = FORBIDDEN.exec(line)
          if (m) hits.push(`${rel}:${i + 1}: ${m[0]}`)
        })
    }
  }
}
for (const d of DIRS) walk(join(ROOT, d))

if (hits.length) {
  console.error('Nome de sistema fora do core e dos templates:')
  for (const h of hits) console.error(`  ${h}`)
  process.exit(1)
}
console.log(`ok: nenhum nome de sistema em ${DIRS.length} pastas`)
