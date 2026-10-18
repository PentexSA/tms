// Confere o que entrou no bundle web do app (doc/plano-v0.md, Etapa 9). Lê os
// source maps de `expo export -p web --source-maps` e falha se algum módulo
// de servidor foi empacotado: driver do Postgres, Kysely, PGLite, Ajv (usa
// new Function) ou o config do servidor.
//
// Uso: node scripts/check-bundle.mjs apps/frontend/dist
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FORBIDDEN = [
  /node_modules\/pg(-[a-z]+)?\//,
  /node_modules\/kysely(-[a-z]+)?\//,
  /node_modules\/@electric-sql\/pglite\//,
  /node_modules\/ajv(-[a-z]+)?\//,
  /node_modules\/pino(-[a-z]+)?\//,
  /packages\/(db|config|logger)\/(src|dist)\//,
  /apps\/api\//,
]

const dir = process.argv[2]
if (!dir) {
  console.error('Uso: node scripts/check-bundle.mjs <pasta do export>')
  process.exit(1)
}

const maps = []
const walk = d => {
  for (const name of readdirSync(d)) {
    const p = join(d, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (name.endsWith('.js.map')) maps.push(p)
  }
}
walk(dir)
if (!maps.length) {
  console.error(`Nenhum source map em ${dir}: exporte com --source-maps`)
  process.exit(1)
}

const found = new Set()
let sources = 0
for (const map of maps) {
  const { sources: list = [] } = JSON.parse(readFileSync(map, 'utf8'))
  sources += list.length
  for (const s of list)
    if (FORBIDDEN.some(re => re.test(s)))
      found.add(s.replace(/^.*node_modules\//, 'node_modules/'))
}
if (found.size) {
  console.error(`Módulos de servidor no bundle do app (${found.size}):`)
  for (const s of [...found].sort().slice(0, 40)) console.error(`  - ${s}`)
  process.exit(1)
}
console.log(
  `bundle ok: ${maps.length} source map(s), ${sources} módulos, nenhum de servidor`
)
