import type { LayoutName } from '@tms/sheet-core'
import { FactsLayout } from './FactsLayout'
import { ListLayout } from './ListLayout'
import { TextLayout } from './TextLayout'
import type { Layout } from './types'

export type { Layout, LayoutProps } from './types'

// Um layout por nome da lista fechada (o build quebra se faltar um). Grade,
// grupos e pirâmide ricos entram na Etapa 18; até lá, viram lista com títulos.
export const layouts = {
  facts: FactsLayout,
  text: TextLayout,
  fields: ListLayout,
  list: ListLayout,
  groups: ListLayout,
  grid: ListLayout,
  pyramid: ListLayout,
} satisfies Record<LayoutName, Layout>

export function layoutFor(name: string): Layout {
  return Object.hasOwn(layouts, name) ? layouts[name as LayoutName] : ListLayout
}
