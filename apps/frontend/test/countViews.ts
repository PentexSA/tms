import { type ComponentType, createElement } from 'react'

// Conta os renders de cada campo embrulhando o resolveView do registry. Fica
// fora do jest.mock porque o plugin do NativeWind reescreve o createElement.
export function countingViews<
  T extends { resolveView: (...a: never[]) => unknown },
>(actual: T) {
  const renders = new Map<string, number>()
  const wrapped = new Map<
    unknown,
    ComponentType<{ resolved: { id: string } }>
  >()
  const resolveView = (...args: Parameters<T['resolveView']>) => {
    const View = (
      actual.resolveView as (...a: unknown[]) => ComponentType<never>
    )(...args)
    let counted = wrapped.get(View)
    if (!counted) {
      counted = (props: { resolved: { id: string } }) => {
        const id = props.resolved.id
        renders.set(id, (renders.get(id) ?? 0) + 1)
        return createElement(View, props as never)
      }
      wrapped.set(View, counted)
    }
    return counted
  }
  return { ...actual, renders, resolveView }
}
