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

/** "às 14:05" hoje; "em 12/10 às 14:05" em outro dia (última alteração). */
export const whenLabel = (value: string | Date, now = new Date()) => {
  const d = new Date(value)
  const today = d.toDateString() === now.toDateString()
  return today ? `às ${hhmm(d)}` : `em ${shortDate(d)} às ${hhmm(d)}`
}
