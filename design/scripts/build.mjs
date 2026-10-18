// Build do design: gera tokens.css, valida templates e personagens e empacota os dados do protótipo.
//
// Uso: node design/scripts/build.mjs
// Sem dependências. Sai com código 1 se algum template ou personagem for inválido.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateSheet, validateTemplate } from './validate.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = p => JSON.parse(readFileSync(join(root, p), 'utf8'))

const tokens = readJson('design-system/tokens.json')
const skins = readdirSync(join(root, 'design-system/skins'))
  .filter(f => f.endsWith('.json'))
  .map(f => readJson(`design-system/skins/${f}`))

// ---------- tokens.css ----------

const px = n => `${n}px`
const rem = n => `${+(n / 16).toFixed(4)}rem`

function themeBlock(theme) {
  const lines = []
  for (const t of [...tokens.color.core, ...tokens.color.accentAlt]) lines.push(`  --${t.name}: ${t.value[theme]};`)
  for (const a of tokens.color.accents.palette) {
    const v = a.value[theme]
    lines.push(`  --${a.name}: ${v.fill};`, `  --${a.name}-text: ${v.text};`, `  --on-${a.name}: ${v.on};`)
  }
  for (const e of tokens.elevation) lines.push(`  --${e.name}: ${e.value[theme]};`)
  // Repetido aqui (e não só em :root) porque var() é resolvido no elemento que define a variável:
  // um trecho com outro data-theme precisa recalcular o accent padrão.
  lines.push('  --accent: var(--accent-neutral);', '  --accent-text: var(--accent-neutral);', '  --on-accent: var(--on-accent-neutral);')
  lines.push(`  color-scheme: ${theme === 'noite' ? 'dark' : 'light'};`)
  return lines.join('\n')
}

function staticBlock() {
  const lines = []
  lines.push(`  --font-sans: ${tokens.type.families.sans.web};`)
  lines.push('  --font-display: var(--font-sans);', '  --font-voice: var(--font-sans);')
  for (const s of tokens.type.styles) {
    lines.push(
      `  --type-${s.name}-size: ${rem(s.size)};`,
      `  --type-${s.name}-line: ${s.lineHeight};`,
      `  --type-${s.name}-weight: ${s.weight};`,
      `  --type-${s.name}-spacing: ${px(s.letterSpacing ?? 0)};`,
    )
  }
  for (const group of ['space', 'radius', 'size', 'border', 'layer', 'layout']) {
    for (const t of tokens[group]) lines.push(`  --${t.name}: ${group === 'layer' ? t.value : px(t.value)};`)
  }
  for (const d of tokens.motion.duration) lines.push(`  --${d.name}: ${d.value}ms;`)
  for (const e of tokens.motion.easing) lines.push(`  --${e.name}: ${e.value};`)
  return lines.join('\n')
}

// A família vai direto na classe (e não numa variável em :root) para que data-skin e
// data-plain-titles num trecho da página troquem a fonte daquele trecho.
const familyOf = s => (s.family === 'sans' ? 'var(--font-sans)' : s.family === 'skin.display' ? 'var(--font-display)' : 'var(--font-voice)')

function typeClasses() {
  return tokens.type.styles
    .map(s => {
      const extra = [
        s.italic ? 'font-style: italic;' : '',
        s.transform ? `text-transform: ${s.transform};` : '',
        s.numeric === 'tabular' ? 'font-variant-numeric: tabular-nums;' : '',
      ].filter(Boolean)
      return `.t-${s.name} { font-family: ${familyOf(s)}; font-size: var(--type-${s.name}-size); line-height: var(--type-${s.name}-line); font-weight: var(--type-${s.name}-weight); letter-spacing: var(--type-${s.name}-spacing); ${extra.join(' ')} }`
    })
    .join('\n')
}

const accentScopes = [
  '[data-accent="accent-neutral"] { --accent: var(--accent-neutral); --accent-text: var(--accent-neutral); --on-accent: var(--on-accent-neutral); }',
  ...tokens.color.accents.palette.map(
    a => `[data-accent="${a.name}"] { --accent: var(--${a.name}); --accent-text: var(--${a.name}-text); --on-accent: var(--on-${a.name}); }`,
  ),
].join('\n')

const skinScopes = skins
  .map(s => `[data-skin="${s.id}"] { --font-display: ${s.type.display.web}; --font-voice: ${s.type.voice.web}; --pip-shape: ${s.pip}; }`)
  .join('\n')

const reduced = tokens.motion.duration.map(d => `--${d.name}: 0ms;`).join(' ')

const css = `/* Gerado por design/scripts/build.mjs a partir de tokens.json e skins/*.json. Não edite à mão. */
/* Breakpoints (media queries não aceitam variáveis): ${tokens.breakpoint.map(b => `${b.name} ${b.min}${b.max ? `–${b.max}` : '+'}`).join(', ')}. */

:root {
${staticBlock()}
}

:root,
[data-theme="noite"] {
${themeBlock('noite')}
}

[data-theme="pergaminho"] {
${themeBlock('pergaminho')}
}

@media (prefers-color-scheme: light) {
  [data-theme="sistema"] {
${themeBlock('pergaminho').replaceAll('\n  ', '\n    ').replace(/^ {2}/, '    ')}
  }
}

/* Accent: o template mapeia a identidade do personagem para um accent-N. Fora da ficha, accent-neutral. */
${accentScopes}

/* Skins: só fonte display, voz e forma do pip. */
${skinScopes}

/* Acessibilidade: títulos sem fonte decorativa. */
[data-plain-titles="true"] { --font-display: var(--font-sans); --font-voice: var(--font-sans); }

@media (prefers-reduced-motion: reduce) {
  :root { ${reduced} }
}
[data-reduced-motion="true"] { ${reduced} }

/* Estilos de texto */
${typeClasses()}
`

writeFileSync(join(root, 'design-system/tokens.css'), css)
// Para a vitrine abrir direto do disco (file://), sem fetch().
writeFileSync(
  join(root, 'design-system/tokens.js'),
  `// Gerado por design/scripts/build.mjs. Não edite à mão.\nwindow.TMS_TOKENS = ${JSON.stringify({ tokens, skins })}\n`,
)

// ---------- validação ----------

const palette = tokens.color.accents.palette.map(a => a.name)
const templates = {}
for (const f of readdirSync(join(root, 'templates')).filter(f => f.endsWith('.json') && f !== 'schema.json')) {
  const t = readJson(`templates/${f}`)
  templates[t.system] = t
}
const examples = readJson('templates/exemplos/personagens.json')

const errors = []
for (const t of Object.values(templates)) errors.push(...validateTemplate(t, palette))
for (const c of examples.characters) {
  const t = templates[c.system]
  if (!t) { errors.push(`${c.id}: sistema '${c.system}' sem template`); continue }
  errors.push(...validateSheet(t, c.sheet, c.id))
  if (!examples.chronicles.some(ch => ch.id === c.chronicleId && ch.system === c.system)) errors.push(`${c.id}: crônica inexistente ou de outro sistema`)
}

if (errors.length) {
  console.error(`Templates ou personagens inválidos (${errors.length}):`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

// ---------- pacote do protótipo ----------
// Um .js em vez de fetch() de .json, para o protótipo abrir direto do disco (file://).

const data = {
  generatedFrom: 'design/templates/*.json e design/templates/exemplos/personagens.json',
  palette,
  skins: Object.fromEntries(skins.map(s => [s.id, { id: s.id, name: s.name, pip: s.pip }])),
  templates,
  ...examples,
}
writeFileSync(
  join(root, 'telas/dados.js'),
  `// Gerado por design/scripts/build.mjs. Não edite à mão: edite os .json em design/templates.\nwindow.TMS_DATA = ${JSON.stringify(data)}\n`,
)

// O mesmo validador no navegador (script clássico, para abrir via file://): o protótipo valida o
// que reidrata do localStorage. Na implementação, um módulo compartilhado entre app e API.
const validatorSource = readFileSync(join(root, 'scripts/validate.mjs'), 'utf8').replace(/^export /gm, '')
writeFileSync(
  join(root, 'telas/validate.js'),
  `// Gerado por design/scripts/build.mjs a partir de scripts/validate.mjs. Não edite à mão.\n;(() => {\n${validatorSource}\nwindow.TMSValidate = { REGISTRY, isSafeText, validateTemplate, validateSheet }\n})()\n`,
)

// ---------- paleta para o @tms/sheet-core ----------
// O core não lê arquivo: a paleta validada (accent-N) vira uma constante TS.

writeFileSync(
  join(root, '../packages/sheet-core/src/palette.ts'),
  `// Gerado por design/scripts/build.mjs a partir de design/design-system/tokens.json.
// Não edite à mão: rode \`node design/scripts/build.mjs\`.

// Paleta de accent validada no CI (contraste e daltonismo): o template só pode
// citar estes nomes, além de accent-neutral.
export const PALETTE = [
${palette.map(n => `  '${n}',`).join('\n')}
] as const
`,
)

console.log(`tokens.css gerado; ${Object.keys(templates).length} templates e ${examples.characters.length} personagens válidos; telas/dados.js gerado.`)
