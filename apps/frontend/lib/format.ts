export const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

/** dd/mm, para datas próximas (convites, última alteração). */
export const shortDate = (value: string | Date) => {
  const d = new Date(value)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}
