export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

/** dd/mm, para datas próximas (convites, última alteração). */
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
