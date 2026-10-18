import type { LayoutName } from '@tms/sheet-core'
import { FactsLayout } from './FactsLayout'
import { GridLayout } from './GridLayout'
import { GroupsLayout } from './GroupsLayout'
import { ListLayout } from './ListLayout'
import { TextLayout } from './TextLayout'
import type { Layout } from './types'

export type { Layout, LayoutProps } from './types'

// Um layout por nome da lista fechada (o build quebra se faltar um). A
// pirâmide (Fate) ainda vira lista com títulos: degrada, nunca quebra.
export const layouts = {
  facts: FactsLayout,
  text: TextLayout,
  fields: ListLayout,
  list: GroupsLayout,
  groups: GroupsLayout,
  grid: GridLayout,
  pyramid: ListLayout,
} satisfies Record<LayoutName, Layout>

export function layoutFor(name: string): Layout {
  return Object.hasOwn(layouts, name) ? layouts[name as LayoutName] : ListLayout
}
