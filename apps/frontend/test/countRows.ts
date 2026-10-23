import { type ComponentType, createElement, memo } from 'react'

// Conta os renders de cada linha da Mesa embrulhando o TableRow (memo, como o
// de verdade): filtrar e ordenar não podem redesenhar as linhas que ficam.
// Fica fora do jest.mock porque o plugin do NativeWind reescreve o
// createElement.
export function countingRows<T extends { TableRow: ComponentType<never> }>(
  actual: T
) {
  const renders = new Map<string, number>()
  const TableRow = memo((props: { item: { row: { id: string } } }) => {
    const id = props.item.row.id
    renders.set(id, (renders.get(id) ?? 0) + 1)
    return createElement(actual.TableRow, props as never)
  })
  return { ...actual, TableRow, renders }
}
