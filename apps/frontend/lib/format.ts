export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Data civil (coluna `date`, como a da sessão): "2026-11-01" → "01/11/2026",
 * ou "01/11" com `year: false`. Corta o texto e não usa `Date`: o dia é o
 * mesmo em qualquer fuso. Fora do formato, `null`, e a tela omite a data em
 * vez de inventar uma (T-16).
 */
export const civilDate = (
  value: string,
  { year = true }: { readonly year?: boolean } = {}
): string | null => {
  const match = CIVIL_DATE.exec(value)
  if (!match) return null
  const [, yyyy, mm, dd] = match
  const month = Number(mm)
  const day = Number(dd)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return year ? `${dd}/${mm}/${yyyy}` : `${dd}/${mm}`
}

/**
 * dd/mm, para instantes próximos (convites, última alteração), no fuso de
 * quem vê. Nunca recebe data civil: "2026-11-01" é meia-noite UTC e volta um
 * dia no Brasil. Para a coluna `date`, use `civilDate`.
 */
export const shortDate = (value: string | Date) => {
  const d = new Date(value)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

export const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

/**
 * O começo de um texto longo, para um bloco que leva a ele (P14-D, a
 * Apresentação da crônica). Conta pontos de código (`Array.from`), então não
 * parte um emoji nem um par substituto. Corta no último espaço antes de
 * `max`; sem espaço, em `max`. O "…" entra só quando corta. O corte é no
 * código, e não só no desenho (`numberOfLines`): o leitor de tela recebe o
 * trecho, nunca o texto inteiro.
 */
export const excerpt = (text: string, max: number): string => {
  // Uma linha corrida: quebras e espaços seguidos viram um espaço, senão o
  // trecho gastaria as linhas com parágrafos em branco
  const trimmed = text.replace(/\s+/g, ' ').trim()
  const points = Array.from(trimmed)
  if (points.length <= max) return trimmed
  const head = points.slice(0, max)
  // O último espaço antes do limite, se ele não deixar o trecho vazio
  let cut = head.length
  for (let i = head.length - 1; i > 0; i--)
    if (/\s/.test(head[i] ?? '')) {
      cut = i
      break
    }
  return `${head.slice(0, cut).join('').trimEnd()}…`
}

/**
 * Os parágrafos de um texto puro: separados por linha em branco (também
 * `\r\n` e linha só com espaços). A quebra simples fica dentro do parágrafo.
 * Nenhum parser: `*`, `#` e `[]()` voltam como foram escritos.
 */
export const paragraphs = (text: string): string[] =>
  text
    .split(/\r?\n[ \t]*\r?\n/)
    .map(p => p.replace(/^(?:[ \t]*\r?\n)+/, '').trimEnd())
    .filter(p => p.trim() !== '')

/** "às 14:05" hoje; "em 12/10 às 14:05" em outro dia (última alteração). */
export const whenLabel = (value: string | Date, now = new Date()) => {
  const d = new Date(value)
  const today = d.toDateString() === now.toDateString()
  return today ? `às ${hhmm(d)}` : `em ${shortDate(d)} às ${hhmm(d)}`
}
